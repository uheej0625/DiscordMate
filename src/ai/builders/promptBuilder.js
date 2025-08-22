import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import * as chattingService from '../../services/chattingService.js';
import * as messageRepository from '../../repositories/messageRepository.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import config from '../../../config.json' assert { type: 'json' };

/**
 * Loads a prompt file and replaces variables, returning it as a string.
 * @param {string} category - Prompt category (system, user)
 * @param {string} filename - Prompt filename (without extension)
 * @param {Object} variables - Variables to replace
 * @returns {string} Prompt string with variables replaced
 */
function loadAndReplaceTemplate(category, variables = {}) {
  const systemPrompt = config.ai.system_prompt;
  const userPrompt = config.ai.user_prompt;

  const promptsPath = path.join(__dirname, '..', 'prompts');

  const promptFile = category === "system" ? systemPrompt : 
                     category === "user" ? userPrompt : 
                     (() => { throw new Error(`Unsupported category: ${category}`) })();

  const filePath = path.join(promptsPath, category, `${promptFile}.md`);
  
  const template = fs.readFileSync(filePath, 'utf-8');
  
  return template.replace(/{{([^}]+)}}/g, (match, key) => {
    const value = key.split('.').reduce((obj, k) => obj?.[k], variables);
    return value !== undefined ? value : match;
  });
}

/**
 * Builds the complete prompt array for Gemini API request.
 * @param {string} userId - User's unique identifier
 * @param {string} userInput - User's input message
 * @param {number} timestamp - Request timestamp
 * @returns {Array} Complete prompt array for Gemini API
 */
export async function buildGeminiPrompt(userId, userInput, timestamp, channelId) {
  const config = JSON.parse(fs.readFileSync(path.join(__dirname, '../../..', 'config.json'), 'utf-8'));

  const variables = {
    char: config.reference.char,
    user: config.reference.user,
    previousStory: '', // TODO: Get from ConversationService
    userInput: userInput,
    current_date: new Date(timestamp).toLocaleString()
  };

  const promptArray = [];

  // 2) System prompt (keep your existing convention)
  promptArray.push({
    role: 'user',
    parts: [{ text: loadAndReplaceTemplate('system', variables) }]
  });

  // 3) Load channel history in descending timestamp order and reverse to get ascending order
  //    This approach makes it easier to handle context limits by getting recent messages first
  const history = await messageRepository.getByChannelId(channelId);
  
  // Reverse to get ascending timestamp order (oldest first)
  const orderedHistory = history.reverse();

  // 4) Fold messages into turns
  //    currentTurn = { role: 'user'|'assistant', parts: [{ text }] }
  const turns = [];
  let currentTurn = null;

  for (const msg of orderedHistory) {
    const content = (msg?.content ?? '').toString().trim();
    if (!content) continue; // ignore empty

    // Decide speaker role
    const role = msg.author_id === userId ? 'user' : 'model';

    // If same speaker as the current turn, append; else start a new turn
    if (currentTurn && currentTurn.role === role) {
      currentTurn.parts.push({ text: content });
    } else {
      if (currentTurn) turns.push(currentTurn);
      currentTurn = { role, parts: [{ text: content }] };
    }
  }
  if (currentTurn) turns.push(currentTurn);

  // 5) Push folded turns into promptArray
  for (const turn of turns) {
    promptArray.push(turn);
  }

  // 6) (Optional) Add current user input template at the end
  //    If you call this before sending a new user message, keep it.
  promptArray.push({
    role: 'user',
    parts: [{ text: loadAndReplaceTemplate('user', { userInput }) }]
  });

  return promptArray;
}