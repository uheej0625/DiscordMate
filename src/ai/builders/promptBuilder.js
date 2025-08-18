import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import repositories from '../../database/database.js';
import { text } from 'stream/consumers';

const { messageRepository, userRepository } = repositories;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const config = JSON.parse(fs.readFileSync(path.join(__dirname, '../../..', 'config.json'), 'utf-8'));

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
export async function buildGeminiPrompt(userId, userInput, timestamp) {
  const config = JSON.parse(fs.readFileSync(path.join(__dirname, '../../..', 'config.json'), 'utf-8'));

  const variables = {
    char: config.char,
    user: config.user,
    previousStory: '', // TODO: Get from ConversationService
    userInput: userInput
  };

  // Build base prompt array
  const promptArray = [];

  // Add system prompt
  promptArray.push({
    role: 'user',
    parts: [{ text: loadAndReplaceTemplate('system', variables) }]
  });

  // Add chat history context
  let messages = await messageRepository.findByTurnId("1");
  console.log(messages);
  while (messages) {
    if (messages[0].author_role === 'USER') {
      const userMessages = [];
      for (const message of messages) {
        userMessages.push({
          text: message.content
        });
      }
      promptArray.push({
        role: 'user',
        parts: userMessages
      });
    } else if (messages[0].author_role === 'ASSISTANT') {
      const assistantMessages = [];
      for (const message of messages) {
        assistantMessages.push({
          text: message.content
        });
      }
      promptArray.push({
        role: 'assistant',
        parts: assistantMessages
      });
    }
    messages = await messageRepository.findByTurnId((Number(messages[0].turn_id) + 1).toString());
  }

  // Add current user input
  promptArray.push({
    role: 'user',
    parts: [{ text: loadAndReplaceTemplate('user', variables) }]
  });

  return promptArray;
}