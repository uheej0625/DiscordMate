//import { getMessageResponse } from '../ai/index.js';
import { aiService } from '../ai/aiService.js';
import repositories from '../database/index.js';
import { MESSAGE_STATUS } from '../database/schemas/messages.js';

const { messageRepository, userRepository } = repositories;
const userBuffers = new Map();
const TIMEOUT_MS = 5000;

export default function handleMessage(message) {
    try {
    const userId = message.author.id;

    // Check if the user exists in the database, if not, create a new user
    let user = userRepository.findById(userId);
    if (!user) {
      const { username = null, globalName = null } = message.author;
      userRepository.create({ userId, username, globalName });
    }

    // Save the message to the database
    messageRepository.create({
      discordId: message.id,
      userId,
      channelId: message.channel.id,
      guildId: message.guild ? message.guild.id : null,
      content: message.content,
      createdAt: message.createdTimestamp,
    });

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
          timestamp: buffer.messages[0].createdTimestamp
        };
        
        // Update the status of pending messages to 'processing'
        for (const bufferedMessage of buffer.messages) {
          messageRepository.updateByDiscordId(bufferedMessage.id, { response_status: MESSAGE_STATUS.PROCESSING });
        }

        const reply = await aiService.generateResponse(payload);
        console.log('AI Response:', reply);
        
        // Send response to the channel of the last message
        const lastMessage = buffer.messages[buffer.messages.length - 1];
        await lastMessage.channel.send(reply);

        // Update the status of processed messages to 'success'
        for (const bufferedMessage of buffer.messages) {
          messageRepository.updateByDiscordId(bufferedMessage.id, { response_status: MESSAGE_STATUS.SUCCESS });
        }

        // Clear the buffer after processing
        buffer.messages = [];
        buffer.timer = null;
      } catch (error) {
        console.error('Error in timeout handler:', error);
        // Update the status of failed messages
        for (const bufferedMessage of buffer.messages) {
          messageRepository.updateByDiscordId(bufferedMessage.id, { response_status: MESSAGE_STATUS.FAILED });
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
        messageRepository.updateByDiscordId(bufferedMessage.id, { response_status: MESSAGE_STATUS.FAILED });
      }
    }
  }
}
