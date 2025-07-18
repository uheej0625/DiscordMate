import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Loads a prompt file and replaces variables, returning it as a string.
 * @param {string} category - Prompt category (system, user)
 * @param {string} filename - Prompt filename (without extension)
 * @param {Object} variables - Variables to replace
 * @returns {string} Prompt string with variables replaced
 */
function loadAndReplaceTemplate(category, filename, variables = {}) {
  const promptsPath = path.join(__dirname, '..', 'prompts');
  const filePath = path.join(promptsPath, category, `${filename}.md`);
  
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
export function buildGeminiPrompt(userId, userInput, timestamp) {
  const config = JSON.parse(fs.readFileSync(path.join(__dirname, '../../..', 'config.json'), 'utf-8'));

  const variables = {
    char: config.char,
    user: config.user,
    previousStory: '', // TODO: Get from database
    userInput: userInput
  };

  const userPrompt = loadAndReplaceTemplate('user', 'currentInput', variables);

  // Build base prompt array
  const promptArray = [
    {
      role: 'user',
      parts: [{ text: loadAndReplaceTemplate('system', 'systemSetting', variables) }, { text: loadAndReplaceTemplate('system', 'references', variables) }]
    }
  ];

  // TODO: Insert conversation history here
  // const conversationHistory = getConversationHistory(userId);
  // promptArray.push(...conversationHistory);

  // Add current user input
  promptArray.push({
    role: 'user',
    parts: [{ text: userPrompt }]
  });

  return promptArray;
}