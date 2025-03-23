import dotenv from 'dotenv';
import { Client, Collection, GatewayIntentBits, Partials, ActivityType, ChannelType, EmbedBuilder, REST, Routes } from 'discord.js';
import path from 'node:path';
import fs from 'node:fs';

import { pathToFileURL } from 'url';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
dotenv.config();

const __filename = fileURLToPath(import.meta.url);  // 현재 파일의 경로
const __dirname = dirname(__filename);  // 파일 경로에서 디렉토리 추출

//client
const client = new Client({
  intents: [
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.Guilds,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.DirectMessageTyping,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Channel, Partials.GuildMember, Partials.User, Partials.Message],
  allowedMentions: { parse: ['roles'], repliedUser: false }
});

client.login(process.env.BOT_TOKEN);

// Slash command handling
client.commands = new Collection();
const commands = [];
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(`${commandsPath}`).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
  const commandPath = `${commandsPath}/${file}`;
  const commandTemp = await import(pathToFileURL(commandPath).href);
  const command = commandTemp.default;
  client.commands.set(command.data.name, command);
  commands.push(command.data);
}

const rest = new REST({ version: "10" }).setToken(process.env.BOT_TOKEN);
rest
  .put(Routes.applicationCommands(process.env.BOT_ID), { body: commands })
  .then((command) => console.log(`${command.length}개의 커맨드를 푸쉬했습니다`))

// Event handling
const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs.readdirSync(`${eventsPath}`).filter(file => file.endsWith('.js'));
for (const file of eventFiles) {
  const eventPath = `${eventsPath}/${file}`;
  const eventTemp = await import(pathToFileURL(eventPath).href);
  const event = eventTemp.default;
  if (event.once) {
    client.once(event.name, (...args) => event.execute(...args));
  } else {
    client.on(event.name, (...args) => event.execute(...args));
  }
}

// Ignore errors
process.on('unhandledRejection', console.error);
process.on('uncaughtException', console.error);

export default client;