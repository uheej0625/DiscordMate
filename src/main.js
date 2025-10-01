import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { USER_ROLE } from './database/schemas/users.js';

import userRepository from './repositories/userRepository.js';

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

/**
 * Initialize bot user in database if not exists
 */
function initializeBotUser() {
  const botUserId = process.env.DISCORD_CLIENT_ID;
  const existingUser = userRepository.findById(botUserId);
  
  if (!existingUser) {
    userRepository.create({
      userId: botUserId,
      username: config.reference.char.username,
      globalName: config.reference.char.global_name,
      role: USER_ROLE.BOT
    });
    console.log('✅ Bot user initialized in database');
  }
}

console.log('🤖 DiscordMate starting...');

// Initialize bot user
initializeBotUser();

// Discord client (must be imported after bot user is initialized)
import('./discord/discord.js');
