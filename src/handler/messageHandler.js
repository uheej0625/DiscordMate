import { aiService } from '../services/aiService.js';
import { logService } from '../services/logService.js';
import { MESSAGE_STATUS } from '../database/schemas/messages.js';
import { getMessageDelay } from '../utils/messageDelay.js';
import chattingService from '../services/chattingService.js';

const userBuffers = new Map();
const TIMEOUT_MS = 5000;

// 취소된 메시지들의 상태를 CANCELED로 변경하는 함수
const handleCancelledMessages = async (messagesToProcess) => {
  console.log('AI 처리가 취소됨 - PROCESSING 메시지들을 CANCELED로 변경');
  for (const bufferedMessage of messagesToProcess) {
    await chattingService.updateStatus(bufferedMessage.id, MESSAGE_STATUS.CANCELED, 'AI 처리 취소됨');
  }
};

export default async function handleMessage(message) {
  try {
    const userId = message.author.id;
    const channelId = message.channel.id;
    const bufferKey = `${userId}_${channelId}`;
    
    // Save the message to the database
    await chattingService.chat(message, null, null, MESSAGE_STATUS.PENDING);

    if (!userBuffers.has(bufferKey)) {
      userBuffers.set(bufferKey, { messages: [], timer: null, abortController: null });
    }
    const buffer = userBuffers.get(bufferKey);
    
    // AI 처리 중이면 취소
    if (buffer.abortController) {
      buffer.abortController.abort();
      console.log('AI 처리 취소됨 - 새 메시지로 인해');
    }
    
    buffer.messages.push(message);

    if (buffer.timer) {
      clearTimeout(buffer.timer);
    }

    buffer.timer = setTimeout(async () => {
      const startTime = Date.now();
      
      // 현재 처리할 메시지들을 복사하고 AbortController 생성
      const messagesToProcess = [...buffer.messages];
      buffer.messages = [];
      buffer.timer = null;
      buffer.abortController = new AbortController();
      const abortController = buffer.abortController;
      
      try {
        // start processing the buffered messages
        const combinedContent = messagesToProcess.map(m => m.content).join('\n');
        console.log('Combined content:', combinedContent);

        const payload = {
          provider: 'gemini', // AI 프로바이더 지정
          userInput: combinedContent,
          userId: userId,
          timestamp: messagesToProcess[0].createdTimestamp,
          channelId: messagesToProcess[0].channel.id,
          signal: abortController.signal // AbortSignal 추가
        };
        
        // Update the status of pending messages to 'processing'
        for (const bufferedMessage of messagesToProcess) {
          await chattingService.updateStatus(bufferedMessage.id, MESSAGE_STATUS.PROCESSING);
        }


        const aiResponse = await aiService.generateResponse(payload);
        
        const messages = aiResponse.messages;

        // Send response to the channel of the last message
        const lastMessage = messagesToProcess[messagesToProcess.length - 1];

        // Send AI response messages
        const sleep = (ms) => new Promise(res => setTimeout(res, ms));

        for (const aiReply of messages) {
          await lastMessage.channel.sendTyping();
          await sleep(getMessageDelay(aiReply));
          const discordMessage = await lastMessage.channel.send(aiReply);

          // Save the message to the database
          await chattingService.chat(discordMessage, aiResponse.thinking, null, MESSAGE_STATUS.SUCCESS);
        }

        // Update the status of processed messages to 'success'
        for (const bufferedMessage of messagesToProcess) {
          await chattingService.updateStatus(bufferedMessage.id, MESSAGE_STATUS.SUCCESS);
        }

        // 처리 완료 후 AbortController 해제
        buffer.abortController = null;

        // AI 응답 로그 기록
        const processingTime = Date.now() - startTime;
        
        await logService.logAIResponse({
          userId: userId,
          username: lastMessage.author.username,
          userInput: combinedContent,
          aiThinking: aiResponse.thinking,
          aiMessages: messages,
          channelId: lastMessage.channel.id,
          guildId: lastMessage.guild?.id || null,
          processingTime: processingTime,
          apiRequest: aiResponse.apiRequest,
          apiResponse: aiResponse.apiResponse
        });

      } catch (error) {
        // 취소된 경우는 에러 로깅하지 않음
        if (abortController.signal.aborted) {
          await handleCancelledMessages(messagesToProcess);
          return;
        }
        
        console.error('Error in timeout handler:', error);
        
        // 에러 로그 기록
        const lastMessage = messagesToProcess[messagesToProcess.length - 1];
        await logService.logError({
          userId: userId,
          username: lastMessage.author.username,
          channelId: lastMessage.channel.id,
          guildId: lastMessage.guild?.id || null,
          error: error
        });
        
        // Update the status of failed messages
        for (const bufferedMessage of messagesToProcess) {
          await chattingService.updateStatus(bufferedMessage.id, MESSAGE_STATUS.FAILED, error);
        }
        
        // 에러 발생 시 AbortController 해제
        buffer.abortController = null;
      }
    }, TIMEOUT_MS);
  } catch (error) {
    console.error('Error handling message:', error);
    for (const [bufferKey, buffer] of userBuffers.entries()) {
      for (const bufferedMessage of buffer.messages) {
        await chattingService.updateStatus(bufferedMessage.id, MESSAGE_STATUS.FAILED);
      }
    }
  }
}
