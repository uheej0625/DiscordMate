import { GoogleGenAI, Type } from "@google/genai";
import { geminiConfig } from '../../config/gemini.js';

const ai = new GoogleGenAI({ apiKey: geminiConfig.apiKey });

// test
const weatherFunctionDeclaration = {
  name: 'get_current_temperature',
  description: 'Gets the current temperature for a given location.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      location: {
        type: Type.STRING,
        description: 'The city name, e.g. San Francisco',
      },
    },
    required: ['location'],
  },
};

export async function callGeminiAPI(contents) {
  try {
    const response = await ai.models.generateContent({
      model: geminiConfig.model,
      contents: contents,
      config: {
        tools: [{
          functionDeclarations: [weatherFunctionDeclaration]
        }],
      },
    });
    
    // Check for function calls in the response
    if (response.functionCalls && response.functionCalls.length > 0) {
      const functionCall = response.functionCalls[0]; // Assuming one function call
      console.log(`Function to call: ${functionCall.name}`);
      console.log(`Arguments: ${JSON.stringify(functionCall.args)}`);
      // In a real app, you would call your actual function here:
      const result = "맑음"
      return result; // 함수 호출 결과 반환
    }

    return response;
  } catch (error) {
    console.error('Gemini API Error:', error);
    throw new Error(`AI service unavailable: ${error.message}`);
  }
}