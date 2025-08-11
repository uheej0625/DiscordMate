import path from 'node:path';
import fs from 'node:fs';
import { pathToFileURL } from 'url';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

import { Client, Collection, ActivityType, ChannelType, EmbedBuilder, REST, Routes } from 'discord.js';

import { discordConfig } from '../config/discord.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Discord client setup
const client = new Client({
  intents: discordConfig.intents,
  partials: discordConfig.partials
});

// Add connection error handling
client.on('error', error => {
  console.error('Discord client error:', error);
});

client.on('warn', warning => {
  console.warn('Discord warning:', warning);
});

client.login(discordConfig.token).catch(error => {
  console.error('Failed to login to Discord:', error);
  process.exit(1);
});

// Slash command handling
client.commands = new Collection();
const commands = [];
const commandsPath = path.join(__dirname, 'commands');

// Check if commands directory exists and has files
if (fs.existsSync(commandsPath)) {
  const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
  
  for (const file of commandFiles) {
    const commandPath = `${commandsPath}/${file}`;
    const commandTemp = await import(pathToFileURL(commandPath).href);
    const command = commandTemp.default;
    client.commands.set(command.data.name, command);
    commands.push(command.data);
  }
  
  console.log(`📝 Loaded ${commands.length} slash commands`);
} else {
  console.log('📝 No commands directory found, skipping command registration');
}

// Only register commands if there are any
if (commands.length > 0) {
  const rest = new REST({ version: "10" }).setToken(discordConfig.token);
  rest
    .put(Routes.applicationCommands(discordConfig.clientId), { body: commands })
    .then((registeredCommands) => console.log(`✅ Successfully registered ${registeredCommands.length} application commands.`))
    .catch(console.error);
}

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

export default client;