
import {callGeminiAPI} from './providers/gemini.js';

export async function getMessageResponse(payload) {
  const response = await callGeminiAPI(payload);
  return response.candidates?.[0]?.content?.parts?.[0]?.text || '⚠️ 응답 없음';
}
  // 추후 image/audio 처리 분기