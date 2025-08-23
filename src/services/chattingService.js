import * as messageRepository from '../repositories/messageRepository.js';
import * as userRepository from '../repositories/userRepository.js';
import { MESSAGE_STATUS } from '../database/schemas/generations.js';
import { USER_ROLE, USER_ACCESS } from '../database/schemas/users.js';

class ChattingService {
  async chat(message, thinking = null, attachments = null, status = MESSAGE_STATUS.PENDING) {
    const user = userRepository.getById(message.author.id);
    if (!user) {
      let role = message.author.bot == false ? USER_ROLE.USER : USER_ROLE.BOT;
      await userRepository.create({
        userId: message.author.id,
        role,
        access: USER_ACCESS.DEFAULT,
        username: message.author.username,
        globalName: message.author.globalName,
        preferred_name: null
      });
    }

    messageRepository.create(
      {
        message_id: message.id,
        conversation_id: null, // Assuming conversation_id is not used here
        channel_id: message.channel.id,
        guild_id: message.guild ? message.guild.id : null,
        author_id: message.author.id,
        content: message.content,
        thinking: thinking || null,
        attachments: null,
        status,
        error: null,
        message_timestamp: message.createdTimestamp
      }
    )
  }

  async updateStatus(messageId, status, error = null) {
    messageRepository.update(messageId, status, error);
  }
}

export default new ChattingService();
