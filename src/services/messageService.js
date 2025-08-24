import messageRepository from '../repositories/messageRepository.js';
import * as userRepository from '../repositories/userRepository.js';
import { USER_ROLE, USER_ACCESS } from '../database/schemas/users.js';

class MessageService {
  async create(message, attachments = null) {
  // Check if user exists, if not create one
  let user = userRepository.getById(message.author.id);
  if (!user) {
    const created = userRepository.create({
        userId: message.author.id,
        username: message.author.username,
        globalName: message.author.globalName,
        role: message.author.bot ? USER_ROLE.BOT : USER_ROLE.USER
      });
      
      if (created) {
        user = userRepository.getById(message.author.id);
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
   * @returns {Promise<Array>}
   */
  async getToProcessMessages(channelId, userId) {
    const botId = process.env.DISCORD_CLIENT_ID;
    // Find messages in the channel without generation_id and not from bot user
    return await messageRepository.find({
      userId,
      channelId,
      generation_id: null,
      authorId: { $ne: botId }
    });
  }
}

export default new MessageService();
