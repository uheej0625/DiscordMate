import { Events } from 'discord.js';
import { chat, type } from '../../../legacy/interactions/directMessage.js'

let typingUsers = [];

export default {
  name: Events.TypingStart,
  once: false,
  async execute(typing) {
    const { channel, user } = typing;
    if (!channel.guild) return type(typing);
  },
};