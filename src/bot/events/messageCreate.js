import { Events } from 'discord.js';
import generateMessage from  '../../llm/chat/directMessage.js'
export default {
  name: Events.MessageCreate,
  once: false,
  async execute(message) {
    if (message.author.bot || !message.content) return; //Ignore bot messages
    const client = message.client;
    const output = await generateMessage(message.content);
    console.log(output);
    client.channels.cache.get(message.channelId).send(output);
  },
};