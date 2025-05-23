import { GoogleGenAI } from "@google/genai";
import { geminiConfig } from '../../config/gemini.js';
const ai = new GoogleGenAI({ apiKey: geminiConfig.apiKey });

export async function callGeminiAPI(prompt) {
  return await ai.models.generateContent({
    model: geminiConfig.model,
    contents: prompt.userInput,
  });
}