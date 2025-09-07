import fs from 'fs';
import path from 'path';

import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Loads a prompt file and replaces variables, returning it as a string.
 * @param {string} category - Prompt name (e.g., "basic", "test")
 * @param {string} type - Prompt type (e.g., "system", "userInput")
 * @param {Object} variables - Variables to replace
 * @returns {string} Prompt string with variables replaced
 */
export default function templateRenderer(category, type, variables = {}) {
  const promptsPath = path.join(__dirname, '../', 'ai/prompts');

  const filePath = path.join(promptsPath, category, `${type}.md`);

  const template = fs.readFileSync(filePath, 'utf-8');
  
  return template.replace(/{{([^}]+)}}/g, (match, key) => {
    const value = key.split('.').reduce((obj, k) => obj?.[k], variables);
    return value !== undefined ? value : match;
  });
}