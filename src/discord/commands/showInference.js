import { ApplicationCommandType, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, MessageFlags } from 'discord.js';
import generationRepository from '../../repositories/generationRepository.js';

export default {
  data: {
    name: '추론 보기',
    type: ApplicationCommandType.Message,
  },
  /**
   * 메시지에 대한 추론 내역을 표시합니다
   * @param {import("discord.js").MessageContextMenuCommandInteraction} interaction
   */
  async execute(interaction) {
    try {
      // 대상 메시지 가져오기
      const targetMessage = interaction.targetMessage;
      
      // 봇의 메시지인지 확인
      if (targetMessage.author.id !== interaction.client.user.id) {
        return await interaction.reply({
          content: '❌ 봇의 메시지에 대해서만 추론 내역을 볼 수 있습니다.',
          flags: MessageFlags.Ephemeral
        });
      }

      // DB에서 메시지 찾기
      const messageData = await generationRepository.findByMessageId(targetMessage.id);
      
      if (!messageData) {
        return await interaction.reply({
          content: '❌ 해당 메시지의 추론 내역을 찾을 수 없습니다.',
          flags: MessageFlags.Ephemeral
        });
      }

      // 추론 내역이 없는 경우
      if (!messageData.aiThinking) {
        return await interaction.reply({
          content: '❌ 이 메시지에 대한 추론 내역이 없습니다.',
          flags: MessageFlags.Ephemeral
        });
      }

      // 추론 내역 임베드 생성
      const embed = new EmbedBuilder()
        .setTitle('🤔 AI 추론 과정')
        .setDescription(messageData.aiThinking)
        .setColor(0x5865F2)
        .setTimestamp(new Date(messageData.createdAt))
        .setFooter({ 
          text: `메시지 ID: ${targetMessage.id}`,
          iconURL: interaction.client.user.displayAvatarURL()
        });

      // 추론 내역 응답
      await interaction.reply({
        embeds: [embed],
        flags: MessageFlags.Ephemeral // 채널에 공개적으로 표시
      });

    } catch (error) {
      console.error('추론 보기 명령어 실행 중 오류:', error);
      
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: '❌ 추론 내역을 가져오는 중 오류가 발생했습니다.',
          flags: MessageFlags.Ephemeral
        });
      }
    }
  },
};
