import {callGeminiAPI} from './providers/gemini.js';

export async function getGeminiResponse({ type, prompt }) {
  if (type === 'text') {
    const response = await callGeminiAPI(prompt);
    return response.candidates?.[0]?.content?.parts?.[0]?.text || '⚠️ 응답 없음';  // 🔥 여기서 텍스트만 리턴!
  }

  // 추후 image/audio 처리 분기
}