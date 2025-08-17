//import { getMessageResponse } from '../ai/index.js';
import { aiService } from '../services/aiService.js';
import repositories from '../database/database.js';
import { MESSAGE_STATUS } from '../database/schemas/messages.js';
import { getMessageDelay } from '../utils/messageDelay.js';

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

    let turnId;
    if (!turnId) {
      // Find the last message in the channel
      const lastMsg = messageRepository.findByChannelId(message.channel.id, 1)[0];
      if (lastMsg) {
        if (lastMsg.author_id === userId) {
          turnId = lastMsg.turn_id;
        } else {
          const lastTurnNum = lastMsg.turn_id ? parseInt(lastMsg.turn_id, 10) : 0;
          turnId = String(lastTurnNum + 1);
        }
      } else {
        turnId = "1";
      }
    }
    
    // Save the message to the database
    messageRepository.create({
      discordMessageId: message.id,
      authorId: userId,
      authorRole: message.author.bot ? 'ASSISTANT' : 'USER',
      channelId: message.channel.id,
      turnId,
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
          messageRepository.updateByDiscordMessageId(bufferedMessage.id, { response_status: MESSAGE_STATUS.PROCESSING });
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
          messageRepository.create({
            discordMessageId: discordMessage.id,
            authorId: process.env.DISCORD_CLIENT_ID,
            authorRole: 'ASSISTANT',
            channelId: lastMessage.channel.id,
            turnId,
            guildId: lastMessage.guild ? lastMessage.guild.id : null,
            content: message,
            createdAt: lastMessage.createdTimestamp,
          });
        }

        // Update the status of processed messages to 'success'
        for (const bufferedMessage of buffer.messages) {
          messageRepository.updateByDiscordMessageId(bufferedMessage.id, { response_status: MESSAGE_STATUS.SUCCESS });
        }

        // Clear the buffer after processing
        buffer.messages = [];
        buffer.timer = null;
      } catch (error) {
        console.error('Error in timeout handler:', error);
        // Update the status of failed messages
        for (const bufferedMessage of buffer.messages) {
          messageRepository.updateByDiscordMessageId(bufferedMessage.id, { response_status: MESSAGE_STATUS.FAILED });
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
