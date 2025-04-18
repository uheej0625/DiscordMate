import { Events } from 'discord.js';

import handleMessage from '../../handler/messageHandler.js'

export default {
  name: Events.MessageCreate,
  once: false,
  async execute(message) {
    if (message.author.bot) return;
    if (!message.guild) return handleMessage(message);
  },
};