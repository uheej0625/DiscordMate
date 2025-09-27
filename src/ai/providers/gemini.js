import { GoogleGenAI, Type } from "@google/genai";
import { geminiConfig } from '../../config/gemini.js';

const ai = new GoogleGenAI({ apiKey: geminiConfig.apiKey });

/**
 * Gemini API 호출 (타임아웃 및 재시도 로직 포함)
 * @param {Object} payload - API 요청 페이로드
 * @param {number} maxRetries - 최대 재시도 횟수 (기본값: 3)
 * @param {number} timeout - 타임아웃 시간 (ms, 기본값: 30000)
 * @returns {Promise<Object>} API 응답
 */
export async function callGeminiAPI(payload, maxRetries = 3, timeout = 30000) {
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Gemini API call attempt ${attempt}/${maxRetries}`);
      
      // 타임아웃 래퍼
      const response = await Promise.race([
        ai.models.generateContent(payload),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Request timeout')), timeout)
        )
      ]);

      console.log(`Gemini API call successful on attempt ${attempt}`);
      return response;

    } catch (error) {
      lastError = error;
      console.error(`Gemini API Error (attempt ${attempt}/${maxRetries}):`, error.message);

      // 연결 타임아웃 또는 네트워크 오류인 경우에만 재시도
      const isRetryableError = 
        error.code === 'UND_ERR_CONNECT_TIMEOUT' ||
        error.message.includes('timeout') ||
        error.message.includes('ECONNRESET') ||
        error.message.includes('ENOTFOUND') ||
        error.message.includes('Connect Timeout Error');

      if (!isRetryableError || attempt === maxRetries) {
        break;
      }

      // 지수 백오프: 2초, 4초, 8초 대기
      const backoffDelay = Math.min(2000 * Math.pow(2, attempt - 1), 8000);
      console.log(`Retrying in ${backoffDelay}ms...`);
      await new Promise(resolve => setTimeout(resolve, backoffDelay));
    }
  }

  console.error('All Gemini API attempts failed');
  throw new Error(`AI service unavailable after ${maxRetries} attempts: ${lastError.message}`);
}