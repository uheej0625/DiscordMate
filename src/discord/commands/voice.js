import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { SlashCommandBuilder, EmbedBuilder, MessageFlags, ChannelType, PermissionFlagsBits } from 'discord.js';
import voiceService from '../../services/voiceService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const config = JSON.parse(fs.readFileSync(path.join(__dirname, '../../..', 'config.json'), 'utf-8'));

export default {
  data: new SlashCommandBuilder()
    .setName('통화')
    .setDescription('개인 음성채널을 생성합니다.'),
  async execute(interaction) {
    try {
      // 먼저 응답을 보내서 타임아웃 방지
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      // config에 설정된 메인 서버를 가져옵니다
      const guild = interaction.client.guilds.cache.get(config.settings.mainServer_id);
      
      if (!guild) {
        return interaction.editReply({
          content: '설정된 메인 서버를 찾을 수 없습니다.'
        });
      }

      // 카테고리 ID가 있다면 실제 카테고리 객체를 가져옵니다
      let category = null;
      if (config.settings.mainCategory_id) {
        category = guild.channels.cache.get(config.settings.mainCategory_id);
      }

      const voiceChannel = await guild.channels.create({
        name: `${interaction.client.user.username}의 방`,
        type: ChannelType.GuildVoice, 
        parent: category?.id,
        permissionOverwrites: [
          {
            id: guild.roles.everyone,
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak]
          }
        ]
      });

      interaction.editReply({
        content: `<#${voiceChannel.id}>을 생성했어요!`,
        flags: MessageFlags.Ephemeral
      });

      console.log(`음성채널 생성 완료: ${voiceChannel.name} (${voiceChannel.id})`);

      // 음성채널 입장 시도
      const joinSuccess = await voiceService.join(voiceChannel);

      console.log('음성채널 입장 시도 결과:', joinSuccess);
    } catch (error) {
      console.error('음성채널 생성 명령어 실행 중 오류:', error);
      
      // 이미 응답했는지 확인
      if (interaction.deferred || interaction.replied) {
        return interaction.editReply({
          content: '음성채널 생성 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
          flags: MessageFlags.Ephemeral
        });
      } else {
        return interaction.reply({
          content: '음성채널 생성 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
          flags: MessageFlags.Ephemeral
        });
      }
    }
  }
};
