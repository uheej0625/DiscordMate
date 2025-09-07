import { ChannelType, EmbedBuilder, Events, MessageFlags } from 'discord.js';

export default {
  name: Events.InteractionCreate,
  /**
   *
   * @param {import("discord.js").Interaction} interaction
   */
  async execute(interaction) {
    // 슬래시 명령어 처리
    if (interaction.isChatInputCommand()) {
      const command = interaction.client.commands.get(interaction.commandName);

      if (!command) {
        console.error(`No command matching ${interaction.commandName} was found.`);
        return;
      }

      try {
        await command.execute(interaction);
      } catch (error) {
        console.error(error);
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({ content: 'There was an error while executing this command!', flags: MessageFlags.Ephemeral });
        } else {
          await interaction.reply({ content: 'There was an error while executing this command!', flags: MessageFlags.Ephemeral });
        }
      }
      return;
    }

    // 컨텍스트 메뉴 명령어 처리
    if (interaction.isMessageContextMenuCommand()) {
      const command = interaction.client.commands.get(interaction.commandName);

      if (!command) {
        console.error(`No context menu command matching ${interaction.commandName} was found.`);
        return;
      }

      try {
        await command.execute(interaction);
      } catch (error) {
        console.error('Context menu command error:', error);
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({ content: '명령어 실행 중 오류가 발생했습니다!', flags: MessageFlags.Ephemeral });
        } else {
          await interaction.reply({ content: '명령어 실행 중 오류가 발생했습니다!', flags: MessageFlags.Ephemeral });
        }
      }
      return;
    }
  },
};