import { getMessageResponse } from '../ai/ai.js';

export default async function handleMessage(message) {
  const payload = {
    userInput: message.content,
    userId: message.author.id,
    timestamp: message.createdTimestamp,
  };

  const reply = await getMessageResponse(payload);

  console.log(reply);
  await message.channel.send(reply);
}