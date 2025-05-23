import { SlashCommandBuilder, EmbedBuilder, Colors, ButtonBuilder, ButtonStyle, ActionRowBuilder, ComponentType } from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('test')
    .setNameLocalization({
      ko: '테스트',
    })
    .setDescription('Just test')
    .setDescriptionLocalization({
      ko: '그냥 테스트',
    }),
  async execute(interaction) {
    const { client } = interaction
    const user = interaction.user
    interaction.reply('test')
  },
};
