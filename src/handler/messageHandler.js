import aiService from '../services/aiService.js';
import messageService from '../services/messageService.js';
import generationRepository from '../repositories/generationRepository.js';
import { logService } from '../services/logService.js';
import { getMessageDelay } from '../utils/messageDelay.js';
import convertToISO from '../utils/convertToISO.js';

const userBuffers = new Map();
const TIMEOUT_MS = 5000;

// 취소된 메시지들의 상태를 CANCELED로 변경하는 함수
const handleCancelledMessages = async (messages) => {

};

// 버퍼된 메시지들을 실제로 처리하는 함수
const processBufferedMessages = async (messages) => {



  aiService.generateResponse({
    provider: "GEMINI"
  })
};

export default async function handleMessage(message) {
  try {
    const userId = message.author.id;
    
    messageService.create(message);

    // 기존 버퍼가 있으면 타이머를 취소하고 메시지를 추가
    if (userBuffers.has(userId)) {
      const buffer = userBuffers.get(userId);
      clearTimeout(buffer.timeoutId);
      buffer.messages.push(message);
      
      console.log(`Message added to buffer for user ${userId}. Total: ${buffer.messages.length}`);
    } else {
      // 새로운 버퍼 생성
      const buffer = {
        messages: [message],
        timeoutId: null
      };
      userBuffers.set(userId, buffer);
      
      console.log(`New buffer created for user ${userId}`);
    }
    
    // 5초 후에 버퍼된 메시지들을 처리하는 타이머 설정
    const buffer = userBuffers.get(userId);
    buffer.timeoutId = setTimeout(async () => {
      const messagesToProcess = [...buffer.messages];
      userBuffers.delete(userId);
      
      console.log(`Buffer timeout reached for user ${userId}. Processing ${messagesToProcess.length} messages.`);
      
      try {
        await processBufferedMessages(messagesToProcess);
      } catch (error) {
        console.error('Error processing buffered messages:', error);
        await handleCancelledMessages(messagesToProcess);
      }
    }, TIMEOUT_MS);
    
  } catch (error) {
    console.error('Message handling error:', error);
    logService.error('Message Handling Error', error);
  }
}
