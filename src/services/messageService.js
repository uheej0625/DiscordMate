import messageRepository from '../repositories/messageRepository.js';
import userRepository from '../repositories/userRepository.js';
import { USER_ROLE, USER_ACCESS } from '../database/schemas/users.js';

class MessageService {
  async create(message, attachments = null) {
    // Check if user exists, if not create one
    let user = userRepository.findById(message.author.id);
    if (!user) {
      const created = userRepository.create({
        userId: message.author.id,
        username: message.author.username,
        globalName: message.author.globalName,
        role: message.author.bot ? USER_ROLE.BOT : USER_ROLE.USER
      });
      
      if (created) {
        user = userRepository.findById(message.author.id);
      }
    }

    // Create message with new schema
    await messageRepository.create({
      messageId: message.id,
      guildId: message.guild?.id || null,
      channelId: message.channel?.id || null,
      authorId: message.author.id,
      content: message.content,
      attachments,
      timestamp: message.timestamp || Date.now()
    });
  }

  /**
   * Get messages in a channel that do not have a generation_id,
   * excluding messages from the client user (process.env.CLIENT_ID).
   * @param {string} channelId
   * @param {string} userId
   * @returns {Promise<Array>}
   */
  async getToProcessMessages(channelId, userId) {
    const botId = process.env.DISCORD_CLIENT_ID;
    
    try {
      // Find messages in the channel without generation_id and not from bot user
      const messages = messageRepository.find({
        channelId,
        authorId: userId // 특정 유저의 메시지만
      }, {
        orderBy: 'timestamp',
        orderDir: 'asc'
      });
      
      // generationId가 null인 메시지만 필터링 (봇 메시지 제외)
      return messages.filter(msg => 
        !msg.generationId && 
        msg.authorId !== botId
      );
    } catch (error) {
      console.error('Error getting messages to process:', error);
      return [];
    }
  }

  /**
   * Mark messages as processed by linking them to a generation
   * @param {Array<string>} messageIds - Array of message IDs
   * @param {string} generationId - Generation ID to link
   * @param {string} processedAt - Timestamp when processed
   * @returns {Promise<boolean>}
   */
  async markProcessedByGeneration(messageIds, generationId, processedAt) {
    try {
      const promises = messageIds.map(messageId => 
        messageRepository.update(messageId, {
          generationId,
          updatedAt: processedAt
        })
      );
      
      await Promise.all(promises);
      return true;
    } catch (error) {
      console.error('Failed to mark messages as processed:', error);
      return false;
    }
  }
}

export default new MessageService();
