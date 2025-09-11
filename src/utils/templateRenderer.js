import fs from 'fs';
import path from 'path';

import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Loads a prompt file and replaces variables, returning it as a string.
 * @param {string} promptSet - PromptSet name (e.g., "basic", "test")
 * @param {string} responseType - (e.g., "text", "voice")
 * @param {string} document - Document type (e.g., "system", "userInput")
 * @param {Object} variables - Variables to replace
 * @returns {string} Prompt string with variables replaced
 */
export default function templateRenderer(promptSet, responseType, document, variables = {}) {
  const promptsPath = path.join(__dirname, '../', 'ai/prompts');

  const filePath = path.join(promptsPath, promptSet, responseType, `${document}.md`);

  const template = fs.readFileSync(filePath, 'utf-8');
  
  return template.replace(/{{([^}]+)}}/g, (match, key) => {
    const value = key.split('.').reduce((obj, k) => obj?.[k], variables);
    return value !== undefined ? value : match;
  });
}