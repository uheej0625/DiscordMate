import { callGeminiAPI } from '../ai/providers/gemini.js';
import { buildGeminiPrompt } from '../ai/builders/promptBuilder.js';
import { parseModelJson } from '../utils/json.js';

export class AIService {
  /**
   * @returns {Promise<Object>} AI 응답 및 메타데이터
   */
  async generateResponse({ provider, userId, userInput, timestamp, channelId }) {
    try {
      let response;
      let apiRequest;
      let apiResponse;

      switch (provider) {
        case 'gemini': {
          const prompt = await buildGeminiPrompt(userId, userInput, timestamp, channelId);
          console.log('Gemini Prompt built:', prompt);
          
          // API 요청 정보 저장
          apiRequest = {
            model: 'gemini-2.5-flash-preview-05-20',
            contents: prompt
          };
          
          response = await callGeminiAPI(prompt);
          
          // API 응답 정보 저장
          apiResponse = response;
          
          break;
        }
        default:
          throw new Error(`Provider '${provider}' is not available`);
      }

      const parts = response?.candidates?.[0]?.content?.parts ?? [];
      const responseText = parts
        .map(p => p.text ?? '')
        .join('\n')
        .trim();

      const obj = parseModelJson(responseText);
      console.log('Parsed AI Response:', obj);

      if (!obj || !Array.isArray(obj.messages)) {
        throw new Error('응답 JSON에 messages 배열이 없음');
      }

      // API 요청/응답 정보를 포함하여 반환
      return {
        ...obj,
        apiRequest,
        apiResponse
      };
    } catch (error) {
      console.error('Generate Response Error:', error);
      throw error;
    }
  }
}

export const aiService = new AIService();
