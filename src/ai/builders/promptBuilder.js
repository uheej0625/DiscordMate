import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import contextBuilder from './contextBuilder.js';
import templateRenderer from '../../utils/templateRenderer.js';
import voiceService from '../../services/voiceService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Builds the complete prompt array for Gemini API request.
 * @param {string} userId - User's unique identifier
 * @param {string} userInput - User's input message
 * @param {number} timestamp - Request timestamp
 * @returns {Array} Complete prompt array for Gemini API
 */
export async function buildTextPrompt(userId, userInput, timestamp, channelId) {
  const config = JSON.parse(fs.readFileSync(path.join(__dirname, '../../..', 'config.json'), 'utf-8'));

  console.log('Voice channel for user:', voiceService.getSameVoiceChannel(userId));

  const promptSet = voiceService.getSameVoiceChannel(userId) ? 'voice' : config.ai.prompt;

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
    parts: [{ text: templateRenderer(promptSet, 'system', variables) }]
  });

  promptArray.push(...(await contextBuilder(channelId)));

  promptArray.push({
    role: 'user',
    parts: [{ text: templateRenderer(promptSet, 'userInput', variables) }]
  });

  return promptArray;
}

export async function buildVoicePrompt(text) {

  const variables = {
    text: text
  };

  return [{ text: templateRenderer('voice', 'tts', variables) }];
}