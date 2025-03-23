import { SlashCommandBuilder, EmbedBuilder, Colors, ButtonBuilder, ButtonStyle, ActionRowBuilder, ComponentType } from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('test')
    .setDescription('Just test'),
  async execute(interaction) {
    const { client } = interaction
    const user = interaction.user
    interaction.reply('test')
  },
};