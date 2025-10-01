import path from 'node:path';
import fs from 'node:fs';
import { pathToFileURL } from 'url';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

import { Client, Collection, REST, Routes } from 'discord.js';

import { discordConfig } from '../config/discord.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Load JavaScript files from a directory
 * @param {string} dirPath - Directory path to load files from
 * @returns {Promise<Array>} Array of loaded modules
 */
async function loadModulesFromDirectory(dirPath) {
  if (!fs.existsSync(dirPath)) {
    return [];
  }

  const files = fs.readdirSync(dirPath).filter(file => file.endsWith('.js'));
  const modules = [];

  for (const file of files) {
    const filePath = `${dirPath}/${file}`;
    const moduleTemp = await import(pathToFileURL(filePath).href);
    modules.push(moduleTemp.default);
  }

  return modules;
}

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
const commandsPath = path.join(__dirname, 'commands');
const commands = await loadModulesFromDirectory(commandsPath);

if (commands.length > 0) {
  // Add commands to client collection
  commands.forEach(command => {
    client.commands.set(command.data.name, command);
  });
  
  console.log(`📝 Loaded ${commands.length} slash commands`);
  
  // Register commands with Discord
  const rest = new REST({ version: "10" }).setToken(discordConfig.token);
  rest
    .put(Routes.applicationCommands(discordConfig.clientId), { 
      body: commands.map(cmd => cmd.data) 
    })
    .then((registeredCommands) => console.log(`✅ Successfully registered ${registeredCommands.length} application commands.`))
    .catch(console.error);
} else {
  console.log('📝 No commands found, skipping command registration');
}

// Event handling
const eventsPath = path.join(__dirname, 'events');
const events = await loadModulesFromDirectory(eventsPath);

events.forEach(event => {
  if (event.once) {
    client.once(event.name, (...args) => event.execute(...args));
  } else {
    client.on(event.name, (...args) => event.execute(...args));
  }
});

console.log(`🎧 Successfully loaded ${events.length} event handlers`);

export default client;