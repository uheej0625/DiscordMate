import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { USER_ROLE } from './database/schemas/users.js';

import * as messageRepository from './repositories/messageRepository.js';
import * as userRepository from './repositories/userRepository.js';

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
let model = userRepository.getById(process.env.DISCORD_CLIENT_ID);
if (!model) {
  const userId = process.env.DISCORD_CLIENT_ID;
  const username = config.reference.char.username;
  const globalName = config.reference.char.global_name;
  const role = USER_ROLE.BOT;
  userRepository.create({ userId, username, globalName, role });
}