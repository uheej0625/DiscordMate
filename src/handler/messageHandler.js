import { getGeminiResponse } from '../llm/llm.js';
import { geminiConfig } from '../config/gemini.js';

export default async function handleMessage(message) {
  const reply = await getGeminiResponse({ type: 'text', prompt: message.content });
  console.log(reply);
  await message.channel.send(reply);
}