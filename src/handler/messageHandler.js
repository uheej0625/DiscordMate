import { getMessageResponse } from '../ai/index.js';
import repositories from '../database/index.js';

const { messageRepository, userRepository } = repositories;

const userBuffers = new Map();
const TIMEOUT_MS = 10000;

export default function handleMessage(message) {
  const userId = message.author.id;

  let user = userRepository.findById(userId);
  if (!user) {
    const { username = null, globalName = null } = message.author;
    userRepository.create({ userId, username, globalName });
  }
  
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
    const combinedContent = buffer.messages.map(m => m.content).join('\n');
    console.log(combinedContent);
    const payload = {
      userInput: combinedContent,
      userId: userId,
      timestamp: buffer.messages[0].createdTimestamp,
    };
    const reply = await getMessageResponse(payload);
    console.log(reply);
    await message.channel.send(reply);
    buffer.messages = [];
    buffer.timer = null;
  }, TIMEOUT_MS);
}