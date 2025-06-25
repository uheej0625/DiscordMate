
import { aiService } from './aiService.js';

// 기존 함수들을 AIService로 위임
export async function generateMessage(payload) {
  return await aiService.generateResponse(payload);
}

// AIService 인스턴스도 직접 export
export { aiService };

// 추후 image/audio 처리 분기