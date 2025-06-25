import { callGeminiAPI } from './providers/gemini.js';
import { config  } from '../../config.json';

export class AIService {
  constructor() {
    this.provider = config.ai.provider;
  }

  /**
   * Generate AI response
   * @param {Object} payload - { userInput, userId, timestamp }
   * @returns {Promise<string>} - AI response text
   */
  async generateResponse(payload) {
    try {
      let response;
      
      switch(this.provider) {
        case 'gemini':
          response = await callGeminiAPI(payload);
          break;
        default:
          throw new Error(`Provider '${this.provider}' is not available`);
      }
      
      return response.candidates?.[0]?.content?.parts?.[0]?.text || '⚠️ No response';
    } catch (error) {
      console.error('Generate Response Error:', error);
      throw error;
    }
  }
}

// Create singleton instance
export const aiService = new AIService();