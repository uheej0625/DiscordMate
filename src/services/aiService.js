import { callGeminiAPI } from '../ai/providers/gemini.js';
import { buildTextPrompt, buildTTSPrompt } from '../ai/builders/promptBuilder.js';
import { parseModelJson } from '../utils/json.js';
import saveWaveFile from '../utils/saveWaveFile.js';

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
          // API 요청 객체 생성
          apiRequest = await buildTextPrompt(userId, userInput, timestamp, channelId);

          response = await callGeminiAPI(apiRequest);

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

  async generateTTS(provider, text) {
    try {
      let response;
      let apiRequest;
      let apiResponse;

      switch (provider) {
        case 'GEMINI': {
          // API 요청 객체 생성
          apiRequest = await buildTTSPrompt(text);

          response = await callGeminiAPI(apiRequest);

          // API 응답 정보 저장
          apiResponse = response;
          
          const data = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
          const audioBuffer = Buffer.from(data, 'base64');

          const fileName = 'out.wav';
          await saveWaveFile(fileName, audioBuffer);

          break;
        }
      }
    } catch (error) {
      console.error('Generate TTS Error:', error);
      throw error;
    }
  }
}
export default new AIService();
