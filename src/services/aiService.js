import { callGeminiAPI } from '../ai/providers/gemini.js';
import { buildPrompt } from '../ai/builders/promptBuilder.js';
import { parseModelJson } from '../utils/json.js';
import registry from '../ai/functions/registry.js';

export class AIService {
  /**
   * @returns {Promise<Object>} AI 응답 및 메타데이터
   */
  async generateResponse({ provider, userId, userInput, timestamp, channelId, signal }) {
    try {
      let response;
      let apiRequest;
      let apiResponse;

      switch (provider) {
        case 'GEMINI': {
          const prompt = await buildPrompt(userId, userInput, timestamp, channelId);
          
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

      const functionCall = parts.find(p => p.functionCall)?.functionCall;
      let functionResult;
      if (functionCall) {
        try {
          functionResult = await registry.execute(functionCall);
        } catch (err) {
          console.error('Function execution error:', err);
        }
      }

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
        messages: obj.messages,
        thinking: obj.thinking,
        functionResult,
        apiRequest,
        apiResponse
      };
    } catch (error) {
      console.error('Generate Response Error:', error);
      throw error;
    }
  }
}
export default new AIService();

