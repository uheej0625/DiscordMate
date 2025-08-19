//import { getMessageResponse } from '../ai/index.js';
import { aiService } from '../services/aiService.js';
import * as chattingService from '../services/chattingService.js';
import { MESSAGE_STATUS } from '../database/schemas/messages.js';
import { getMessageDelay } from '../utils/messageDelay.js';
import { channel } from 'diagnostics_channel';

const userBuffers = new Map();
const TIMEOUT_MS = 5000;

export default function handleMessage(message) {
  try {
    const userId = message.author.id;
    
    // Save the message to the database
    chattingService.chat(message, null, null, MESSAGE_STATUS.PENDING);

    if (!userBuffers.has(userId)) {
      userBuffers.set(userId, { messages: [], timer: null });
    }
    const buffer = userBuffers.get(userId);
    buffer.messages.push(message);

    if (buffer.timer) {
      clearTimeout(buffer.timer);
    }

    buffer.timer = setTimeout(async () => {
      try {
        // start processing the buffered messages
        const combinedContent = buffer.messages.map(m => m.content).join('\n');
        console.log('Combined content:', combinedContent);

        const payload = {
          provider: 'gemini', // AI 프로바이더 지정
          userInput: combinedContent,
          userId: userId,
          timestamp: buffer.messages[0].createdTimestamp,
          channelId: buffer.messages[0].channel.id
        };
        
        // Update the status of pending messages to 'processing'
        for (const bufferedMessage of buffer.messages) {
          chattingService.updateStatus(bufferedMessage.id, MESSAGE_STATUS.PROCESSING);
        }

        const messages = await aiService.generateResponse(payload);

        // Send response to the channel of the last message
        const lastMessage = buffer.messages[buffer.messages.length - 1];

        // Send AI response messages
        const sleep = (ms) => new Promise(res => setTimeout(res, ms));

        for (const message of messages) {
          await lastMessage.channel.sendTyping();
          await sleep(getMessageDelay(message));
          const discordMessage = await lastMessage.channel.send(message);

          // Save the message to the database
          chattingService.chat(discordMessage, null, null, MESSAGE_STATUS.SUCCESS);
        }

        // Update the status of processed messages to 'success'
        for (const bufferedMessage of buffer.messages) {
          chattingService.updateStatus(bufferedMessage.id, MESSAGE_STATUS.SUCCESS);
        }

        // Clear the buffer after processing
        buffer.messages = [];
        buffer.timer = null;
      } catch (error) {
        console.error('Error in timeout handler:', error);
        // Update the status of failed messages
        for (const bufferedMessage of buffer.messages) {
          chattingService.updateStatus(bufferedMessage.id, MESSAGE_STATUS.FAILED, error);
        }
        // Clear the buffer even on error
        buffer.messages = [];
        buffer.timer = null;
      }
    }, TIMEOUT_MS);
  } catch (error) {
    console.error('Error handling message:', error);
    for (const [userId, buffer] of userBuffers.entries()) {
      for (const bufferedMessage of buffer.messages) {
        messageRepository.updateByDiscordMessageId(bufferedMessage.id, { response_status: MESSAGE_STATUS.FAILED });
      }
    }
  }
}
