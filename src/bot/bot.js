import dotenv from 'dotenv';
dotenv.config();

import { Client, Collection, GatewayIntentBits, Partials, ActivityType, ChannelType, EmbedBuilder, REST, Routes } from 'discord.js';

//client
const client = (
  new Client({
    intents: [GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildMessages, GatewayIntentBits.Guilds, GatewayIntentBits.DirectMessages, GatewayIntentBits.DirectMessageTyping, GatewayIntentBits.MessageContent],
    partials: [Partials.Channel, Partials.GuildMember, Partials.User, Partials.Message],
    allowedMentions: { parse: ['roles'], repliedUser: false}
  })
);
client.login(process.env.BOT_TOKEN);

export default client;