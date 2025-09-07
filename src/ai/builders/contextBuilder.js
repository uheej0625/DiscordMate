import messageRepository from '../../repositories/messageRepository.js';

/**
 * Build turns from a channel's message history (ascending order).
 * - Fetch recent messages in DESC, then reverse to ASC
 * - Fold consecutive messages by the same speaker into a single turn
 * @param {string} channelId
 * @returns {Promise<Array<{ role: 'user'|'model', parts: Array<{ text: string }> }>>}
 */
export default async function contextBuilder(channelId) {
  // 1) Fetch recent-first (DESC). Apply limit at the DB layer if supported.
  const descHistory = await messageRepository.find(
    { channelId },
    { orderBy: 'timestamp', orderDir: 'desc' }
  );

  if (!Array.isArray(descHistory) || descHistory.length === 0) return [];

  // 2) Make ASC without mutating the original array
  const ascHistory = descHistory.slice().reverse();

  // 3) Fold into turns
  const turns = [];
  let currentTurn = null;

  for (const msg of ascHistory) {
    const content = (msg?.content ?? '').toString().trim();
    if (!content) continue;

    const role = msg.authorId === process.env.DISCORD_CLIENT_ID ? 'model' : 'user';

    if (currentTurn && currentTurn.role === role) {
      currentTurn.parts.push({ text: content });
    } else {
      if (currentTurn) turns.push(currentTurn);
      currentTurn = { role, parts: [{ text: content }] };
    }
  }
  if (currentTurn) turns.push(currentTurn);

  // Remove the last turn if it's a user turn
  if (turns.length > 0 && turns[turns.length - 1].role === 'user') {
    turns.pop();
  }

  return turns;
}
