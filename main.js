import 'dotenv/config';

// Error handling
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

// Discord client
import client from './src/discord/index.js';

console.log('🤖 DiscordMate starting...');