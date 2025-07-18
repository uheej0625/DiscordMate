import { callGeminiAPI } from './providers/gemini.js';
import { buildGeminiPrompt } from './builders/promptBuilder.js';

export class AIService {

  /**
   * Generates an AI response based on the given provider and input.
   * @param {Object} params - Parameters for generating a response.
   * @param {string} params.provider - The AI provider to use (e.g., 'gemini').
   * @param {string} params.userId - The user's unique identifier.
   * @param {string} params.userInput - The user's input message.
   * @param {number} params.timestamp - The timestamp of the request.
   * @returns {Promise<string>} The generated AI response text.
   */
  async generateResponse({ provider, userId, userInput, timestamp }) {
    try {
      let response;

      switch(provider) {
        case 'gemini':
          const prompt = buildGeminiPrompt(userId, userInput, timestamp);
          response = await callGeminiAPI(prompt);
          break;
        default:
          throw new Error(`Provider '${provider}' is not available`);
      }
      
      const responseText = response.candidates?.[0]?.content?.parts?.[0]?.text || '⚠️ No response';
      return responseText;
    } catch (error) {
      console.error('Generate Response Error:', error);
      throw error;
    }
  }
}

// Create singleton instance
export const aiService = new AIService();