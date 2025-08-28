import { GoogleGenAI } from "@google/genai";
import { geminiConfig } from '../../config/gemini.js';
import registry from '../functions/registry.js';

const ai = new GoogleGenAI({ apiKey: geminiConfig.apiKey });

export async function callGeminiAPI(contents) {
  try {
    const response = await ai.models.generateContent({
      model: geminiConfig.model,
      contents: contents,
      tools: [{ functionDeclarations: registry.listDeclarations() }]
    });
    
    return response;
  } catch (error) {
    console.error('Gemini API Error:', error);
    throw new Error(`AI service unavailable: ${error.message}`);
  }
}
