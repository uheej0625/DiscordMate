import { getMessageResponse } from '../ai/index.js';

const userBuffers = new Map();
const TIMEOUT_MS = 3000; // 2초 동안 추가 메시지 없으면 flush

async function flushUserBuffer(userId, buffer, message) { 
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
}

export default function handleMessage(message) {
  const userId = message.author.id;
  if (!userBuffers.has(userId)) {
    userBuffers.set(userId, { messages: [], timer: null });
  }
  const buffer = userBuffers.get(userId);
  buffer.messages.push(message);

  if (buffer.timer) {
    clearTimeout(buffer.timer);
  }
  buffer.timer = setTimeout(() => flushUserBuffer(userId, buffer, message), TIMEOUT_MS);
}