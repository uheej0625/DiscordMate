import { GoogleGenAI } from "@google/genai";
import { geminiConfig } from '../../config/gemini.js';

const ai = new GoogleGenAI({ apiKey: geminiConfig.apiKey });

export async function callGeminiAPI(prompt) {
  try {
    const response = await ai.models.generateContent({
      model: geminiConfig.model,
      contents: prompt.userInput,
    });
    
    if (!response || !response.candidates || response.candidates.length === 0) {
      throw new Error('No response candidates from Gemini API');
    }
    
    return response;
  } catch (error) {
    console.error('Gemini API Error:', error);
    throw new Error(`AI service unavailable: ${error.message}`);
  }
}