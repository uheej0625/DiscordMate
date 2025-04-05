import { GoogleGenAI } from "@google/genai";
import { geminiConfig } from '../../config/gemini.js';
const ai = new GoogleGenAI({ apiKey: geminiConfig.apiKey });

async function main() {
  const response = await ai.models.generateContent({
    model: geminiConfig.model,
    contents: "How does AI work?",
  });
  console.log(response.text);
}

await main();