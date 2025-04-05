import dotenv from 'dotenv';
dotenv.config(); // .env 로드

console.log('[main.js] DISCORD_BOT_TOKEN:', process.env.DISCORD_BOT_TOKEN);

// client
import client from './bot/bot.js';