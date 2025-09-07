// handlers/handleMessage.js
import messageService from '../services/messageService.js';
import userRepository from '../repositories/userRepository.js';
import chattingService from '../services/chattingService.js';
import voiceService from '../services/voiceService.js';
import generationRepository from '../repositories/generationRepository.js';
import { getMessageDelay } from '../utils/messageDelay.js';
import { GENERATION_STATUS } from '../database/schemas/generations.js';
import aiService from '../services/aiService.js';

const TIMEOUT_MS = 5000;
const timers = new Map(); // key = `${userId}:${channelId}` -> { timer, lastMessage }

export default async function handleMessage(message) {
  // 봇 메시지는 패스
  if (message?.author?.bot) return;

  const userId = message?.author?.id;
  const channelId = message?.channel?.id;
  if (!userId || !channelId) return;

  const key = `${userId}:${channelId}`;

  // 1) 디스코드 원문 그대로 저장
  await messageService.create(message);

  // 2) 기존 배치 취소 (새 입력으로 교체)
  chattingService.cancelActive(channelId, userId, 'new-input');

  // 3) 5초 디바운스
  if (timers.get(key)?.timer) clearTimeout(timers.get(key).timer);
  timers.set(key, {
    lastMessage: message,
    timer: setTimeout(() => runBatch(key), TIMEOUT_MS),
  });
}

async function runBatch(key) {
  const entry = timers.get(key);
  if (!entry) return;
  timers.delete(key);

  const msg = entry.lastMessage;
  const userId = msg.author.id;
  const channelId = msg.channel.id;

  // UX: 타이핑(있으면 호출)
  await msg.channel.sendTyping();

  // 4) 배치 처리 (AI 호출/취소/DB는 chattingService가 담당)
  const genId = await chattingService.chat(channelId, userId);
  if (!genId) return;

  // 5) 결과 가져와서 보내기 (SUCCESS만)
  const gen = await generationRepository.findById(genId);
  if (!gen || gen.status !== GENERATION_STATUS.SUCCESS) return;

  // 문자열이든 배열이든 최소 지원
  const outs = Array.isArray(gen.aiOutput) ? gen.aiOutput : String(gen.aiOutput ?? '').split('\n').map(s => s.trim()).filter(Boolean);

  // 기존 messageIds에 새로운 sent.id들을 누적해서 추가
  // gen.messageIds는 DB에서 파싱된 배열
  const existingMessageIds = gen.messageIds || [];
  const newMessageIds = [];

  const isVoiceMode = await voiceService.isVoiceMode(msg);
  
  if (isVoiceMode) {
    for (const text of outs) {
      const cleanedText = text.replace(/\([^)]*\)/g, '').trim(); // 지시문이 컨텍스트를 오염시키는 것을 방지
      const sent = makeDummyMessage(cleanedText, channelId);
      await messageService.create(sent);
      newMessageIds.push(sent.id);
    }

    await voiceMode(outs.join('\n'), msg.channel.id);
  } else {
    for (const text of outs) {
      await msg.channel.sendTyping();
      await sleep(getMessageDelay(text));
      const sent = await msg.channel.send(text);
      // 봇이 보낸 것도 저장(필요 최소)
      await messageService.create(sent);
      // 새로운 메시지 ID 수집
      newMessageIds.push(sent.id);
    }
  }

  if (newMessageIds.length > 0) {
    const updatedMessageIds = [...existingMessageIds, ...newMessageIds];
    generationRepository.update(genId, { messageIds: updatedMessageIds });
  }
}

async function voiceMode(text, channelId) {
  aiService.generateTTS('GEMINI', text);
}

function makeDummyMessage(text, channelId) {
  const bot = userRepository.findById(process.env.DISCORD_CLIENT_ID);
  const message = {
    id: `dummy-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
    channel: { id: channelId },
    author: {
      id: bot.id,
      username: bot.username,
      globalName: bot.globalName,
      bot: true
    },
    content: text,
  };

  return message;
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
