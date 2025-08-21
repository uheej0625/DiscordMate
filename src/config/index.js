import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// config.json 파일 경로
const configPath = path.join(__dirname, '../../config.json');

let config = {};

try {
  const configData = fs.readFileSync(configPath, 'utf8');
  config = JSON.parse(configData);
} catch (error) {
  console.warn('Config file not found or invalid, using defaults:', error.message);
  config = {
    ai: {
      provider: 'gemini'
    }
  };
}

export const aiConfig = {
  provider: config.ai?.provider || 'gemini'
};

export default config;
