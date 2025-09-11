import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import contextBuilder from './contextBuilder.js';
import templateRenderer from '../../utils/templateRenderer.js';
import voiceService from '../../services/voiceService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Builds the complete API request object for Gemini text generation.
 * @param {string} userId - User's unique identifier
 * @param {string} userInput - User's input message
 * @param {number} timestamp - Request timestamp
 * @param {string} channelId - Channel identifier
 * @returns {Object} Complete API request object for Gemini
 */
export async function buildTextPrompt(userId, userInput, timestamp, channelId) {
  const config = JSON.parse(fs.readFileSync(path.join(__dirname, '../../..', 'config.json'), 'utf-8'));
  const promptSet = config.ai.prompt;

  const responseType = voiceService.getSameVoiceChannel(userId) ? 'voice' : 'text';

  const variables = {
    char: config.reference.char,
    user: config.reference.user,
    previousStory: '', // TODO: Get from ConversationService
    userInput: userInput,
    current_date: new Date(timestamp).toLocaleString()
  };

  const promptArray = [];

  promptArray.push({
    role: 'user',
    parts: [{ text: templateRenderer(promptSet, responseType, 'system', variables) }]
  });

  promptArray.push(...(await contextBuilder(channelId)));

  promptArray.push({
    role: 'user',
    parts: [{ text: templateRenderer(promptSet, responseType, 'userInput', variables) }]
  });
  
  return {
    model: 'gemini-2.5-flash-preview-05-20',
    contents: promptArray,
    config: {
      // tools: [{
      //   functionDeclarations: [setLightValuesFunctionDeclaration]
      // }],
    },
  };
}

/**
 * Builds the complete API request object for Gemini TTS.
 * @param {string} text - Text to convert to speech
 * @returns {Object} Complete API request object for Gemini TTS
 */
export async function buildTTSPrompt(text) {
  const config = JSON.parse(fs.readFileSync(path.join(__dirname, '../../..', 'config.json'), 'utf-8'));
  const variables = {
    text: text
  };

  const prompt = [{ text: templateRenderer(config.ai.prompt, 'voice', 'tts', variables) }];

  return {
    model: "gemini-2.5-flash-preview-tts",
    contents: prompt,
    config: {
      responseModalities: ['AUDIO'],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: 'Leda' },
        },
      },
    },
  };
}