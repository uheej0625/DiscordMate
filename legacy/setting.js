import { SlashCommandBuilder, EmbedBuilder, Colors, ButtonBuilder, ButtonStyle, ActionRowBuilder, ComponentType } from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('Setting')
    .setNameLocalizations({ 
      'ko': '설정' 
    })
    .setDescription('DiscordMate settings')
    .addSubcommand(subcommand => subcommand
      .setName('llm')
      .setDescription('llm settings')
      .addStringOption(option => option
        .setName('llm provider')
        .setDescription('choose llm provider')
        .setRequired(true)
        .addChoices(
          { name: 'Gemini', value: 'gemini' },
          //{ name: 'Vertex', value: 'gemini' },
          //{ name: 'OpenAI', value: 'openai' },
          //{ name: 'Anthropic', value: 'anthropic' },
        )
      )
      .addStringOption(option => option
        .setName('llm model')
        .setDescription('choose llm model')
        .setRequired(true)

        // 여기에 자동완성 추가

        // .addChoices(
        //   { name: 'Gemini', value: 'gemini' },
        //   { name: 'OpenAI', value: 'openai' },
        //   { name: 'Anthropic', value: 'anthropic' },
        // )
      )
    ),
  async execute(interaction) {
    const { client } = interaction
    const user = interaction.user


    interaction.reply('test')
  },
};