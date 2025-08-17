import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import repositories from './database/database.js';

const { messageRepository, userRepository } = repositories;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const config = JSON.parse(fs.readFileSync(path.join(__dirname, '../', 'config.json'), 'utf-8'));



// Error handling
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

// Discord client
import client from './discord/discord.js';

console.log('🤖 DiscordMate starting...');


// Check if the user exists in the database, if not, create a new user
let assistant = userRepository.findById(process.env.DISCORD_CLIENT_ID);
if (!assistant) {
  const username = config.char.username;
  const globalName = config.char.global_name;
  const preferredName = config.char.preferred_name;

  userRepository.create({ userId: process.env.DISCORD_CLIENT_ID, username, globalName, preferredName });
}