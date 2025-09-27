import { callGeminiAPI } from '../ai/providers/gemini.js';
import { buildTextPrompt, buildTTSPrompt, buildDecisionPrompt } from '../ai/builders/promptBuilder.js';
import { parseModelJson } from '../utils/json.js';
import saveWaveFile from '../utils/saveWaveFile.js';
import { executeFunction } from '../ai/utils/functionLoader.js';

export class AIService {
  /**
   * @returns {Promise<Object>} AI 응답 및 메타데이터
   */
  async generateResponse({ provider, userId, userInput, timestamp, channelId, functionCallResults, signal }) {
    try {
      let response;
      let apiRequest;
      let apiResponse;

      switch (provider) {
        case 'GEMINI': {
          // API 요청 객체 생성
          apiRequest = await buildTextPrompt(userId, userInput, timestamp, channelId, functionCallResults);

          response = await callGeminiAPI(apiRequest);

          // API 응답 정보 저장
          apiResponse = response;
          
          break;
        }
        default:
          throw new Error(`Provider '${provider}' is not available`);
      }

      const responseText = response?.candidates?.[0]?.content?.parts[0].text ?? '';
      console.log('Raw AI Response Text:', responseText);

      const obj = parseModelJson(responseText);
      console.log('Parsed AI Response:', obj);

      if (!obj || !Array.isArray(obj.messages)) {
        throw new Error('응답 JSON에 messages 배열이 없음');
      }

      // API 요청/응답 정보를 포함하여 반환
      return {
        messages: obj.messages,
        thinking: obj.thinking,
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

  async generateDecision({ provider, userInput, channelId }) {
    try {
      let response;
      let apiRequest;
      let apiResponse;

      switch (provider) {
        case 'GEMINI': {
          // API 요청 객체 생성
          apiRequest = await buildDecisionPrompt(userInput, channelId, 2);

          response = await callGeminiAPI(apiRequest);

          // API 응답 정보 저장
          apiResponse = response;
          
          break;
        }
        default:
          throw new Error(`Provider '${provider}' is not available`);
      }

      const responseContent = response?.candidates?.[0]?.content?.parts[0];

      console.log('Decision Response Content:', JSON.stringify(responseContent, null, 2));

      let functionResult = null;
      if (responseContent?.functionCall) {
        console.log('Function Call Detected:', responseContent.functionCall);
        
        try {
          // 함수 실행
          const { name, args } = responseContent.functionCall;
          functionResult = await executeFunction(name, args);
          console.log('Function Result:', functionResult);
        } catch (error) {
          console.error('Function execution error:', error);
          functionResult = `Error executing function: ${error.message}`;
        }
      }

      // AI 응답에서 불필요한 문자들 제거 (개행, 공백, 특수문자 등)
      const cleanText = (responseContent?.text || '')
        .toLowerCase()
        .replace(/[\n\r\t\s]/g, '') // 모든 공백 문자 제거
        .replace(/[^\w]/g, ''); // 알파벳, 숫자가 아닌 문자 제거
      
      let decision;
      if (cleanText === 'reply') {
        decision = 'reply';
      } else if (cleanText === 'wait') {
        decision = 'wait';
      } else if (functionResult !== null) {
        decision = 'functionCall';
      } else {
        decision = 'error';
      }

      return {
        decision: decision,
        functionResult: functionResult, // 함수 실행 결과 추가
        apiRequest,
        apiResponse
      };
 
    } catch (error) {
      console.error('Generate Decision Error:', error);
      throw error;
    }
  }
}
export default new AIService();
