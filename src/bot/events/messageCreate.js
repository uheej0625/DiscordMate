import { Events } from 'discord.js';
import generateMessage from '../../../legacy/chat/directMessage.js'
import { chat, type } from '../../../legacy/interactions/directMessage.js'

let messageBuffer = []; // 메시지를 저장할 배열
let typingTimeout = null; // 타이핑 중지 타이머

export default {
  name: Events.MessageCreate,
  once: false,
  async execute(message) {
    if (message.author.bot) return;
    if (!message.guild) return chat(message);
  },
};