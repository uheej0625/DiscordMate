import db from './index.js';
import { randomUUID } from 'crypto';

/**
 * 메시지 저장
 * @param {object} param0
 * @param {string} param0.discordId - 디스코드 메시지 id
 * @param {string} param0.userId - 디스코드 유저 id
 * @param {string} param0.content - 메시지 내용
 * @param {number|string|Date} [param0.timestamp] - createdTimestamp(ms) 또는 Date/ISO 문자열(선택)
 */

export function saveMessage({ discordId, userId, content, timestamp}) {
  if (!timestamp) {
    timestamp = new Date().toISOString();
  } else if (typeof timestamp === 'number') {
    timestamp = new Date(timestamp).toISOString();
  } else if (timestamp instanceof Date) {
    timestamp = timestamp.toISOString();
  }
  
  try {
    db.prepare(`
      INSERT INTO messages (id, discord_id, user_id, content, timestamp)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      randomUUID(),
      discordId,
      userId,
      content,
      timestamp
    );
  } catch (e) {
    console.error('DB 저장 오류:', e);
  }
}
