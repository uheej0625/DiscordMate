import { callGeminiAPI } from '../ai/providers/gemini.js';
import { buildGeminiPrompt } from '../ai/builders/promptBuilder.js';
import { parseModelJson } from '../utils/json.js';

export class AIService {
  /**
   * @returns {Promise<string[]>} 메시지 배열
   */
  async generateResponse({ provider, userId, userInput, timestamp, channelId }) {
    try {
      let response;

      switch (provider) {
        case 'gemini': {
          const prompt = buildGeminiPrompt(userId, userInput, timestamp, channelId);
          console.log('Gemini Prompt built');
          response = await callGeminiAPI(prompt);
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

      return obj.messages;
    } catch (error) {
      console.error('Generate Response Error:', error);
      throw error;
    }
  }
}

export const aiService = new AIService();