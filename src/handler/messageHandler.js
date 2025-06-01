import { getMessageResponse } from '../ai/index.js';
import { saveMessage } from '../database/message.js';
import { getUserById, saveUser } from '../database/user.js';

const userBuffers = new Map();
const TIMEOUT_MS = 3000; // 2초 동안 추가 메시지 없으면 flush

export default function handleMessage(message) {
  const userId = message.author.id;

  // 유저가 없으면 생성
  let user = getUserById(userId);
  if (!user) {
    const { username = null, globalName = null } = message.author;
    saveUser({ userId, username, globalName });
  }
  saveMessage({
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
      timestamp: buffer.messages[0].createdTimestamp, // 첫 메시지 기준
    };
    const reply = await getMessageResponse(payload);
    console.log(reply);
    await message.channel.send(reply);
    buffer.messages = [];
    buffer.timer = null;
  }, TIMEOUT_MS);
}