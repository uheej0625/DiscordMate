import { GoogleGenAI, Type } from "@google/genai";
import { geminiConfig } from '../../config/gemini.js';

const ai = new GoogleGenAI({ apiKey: geminiConfig.apiKey });

export async function callGeminiAPI(payload) {
  try {
    const response = await ai.models.generateContent(payload);

    return response;
  } catch (error) {
    console.error('Gemini API Error:', error);
    throw new Error(`AI service unavailable: ${error.message}`);
  }
}