import { SlashCommandBuilder, ChannelType, PermissionFlagsBits, MessageFlags } from 'discord.js';
import config from '../../../config.json' assert { type: 'json' };

export default {
  data: new SlashCommandBuilder()
    .setName('통화')
    .setNameLocalizations({
      'en-US': 'call'
    })
    .setDescription('명령어를 사용한 사람만 입장할 수 있는 음성채팅방을 생성합니다')
    .setDescriptionLocalizations({
      'en-US': 'Creates a private voice channel that only the command user can join'
    }),

  async execute(interaction) {
    try {
      const user = interaction.user;
      const guild = interaction.guild;

      // 카테고리 채널 가져오기
      const category = guild.channels.cache.get(config.settings.mainCategory_id);
      if (!category || category.type !== ChannelType.GuildCategory) {
        return await interaction.reply({
          content: '❌ 설정된 카테고리를 찾을 수 없습니다.',
          flags: MessageFlags.Ephemeral
        });
      }

      // 개인 음성채널 이름 생성
      const channelName = `${user.displayName || user.username}의 통화방`;

      // 이미 해당 사용자의 음성채널이 있는지 확인
      const existingChannel = guild.channels.cache.find(
        channel => channel.type === ChannelType.GuildVoice && 
                  channel.name === channelName &&
                  channel.parentId === category.id
      );

      if (existingChannel) {
        return await interaction.reply({
          content: `❌ 이미 <#${existingChannel.id}> 채널이 존재합니다.`,
          flags: MessageFlags.Ephemeral
        });
      }

      // 음성채널 생성
      const voiceChannel = await guild.channels.create({
        name: channelName,
        type: ChannelType.GuildVoice,
        parent: category,
        permissionOverwrites: [
          {
            id: guild.roles.everyone,
            deny: [PermissionFlagsBits.Connect, PermissionFlagsBits.ViewChannel]
          },
          {
            id: user.id,
            allow: [
              PermissionFlagsBits.Connect,
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.Speak,
              PermissionFlagsBits.ManageChannels,
              PermissionFlagsBits.MoveMembers
            ]
          },
          {
            id: interaction.client.user.id, // 봇에게도 권한 부여
            allow: [
              PermissionFlagsBits.Connect,
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.Speak
            ]
          }
        ]
      });

      // 봇이 음성채널에 입장
      try {
        const { joinVoiceChannel, VoiceConnectionStatus } = await import('@discordjs/voice');
        
        const connection = joinVoiceChannel({
          channelId: voiceChannel.id,
          guildId: guild.id,
          adapterCreator: guild.voiceAdapterCreator,
          selfDeaf: false,
          selfMute: true
        });

        // 연결 상태 관리
        connection.on('stateChange', (oldState, newState) => {
          console.log(`🎙️ 음성 연결 상태 변경: ${oldState.status} -> ${newState.status}`);
        });

        // 5분 후 자동으로 채널 정리 (빈 채널일 경우)
        setTimeout(async () => {
          try {
            const channel = guild.channels.cache.get(voiceChannel.id);
            if (channel) {
              const members = channel.members.filter(member => !member.user.bot);
              if (members.size === 0) {
                connection.destroy();
                await channel.delete();
                console.log(`🗑️ 빈 음성채널 "${channelName}" 자동 삭제됨`);
              }
            }
          } catch (cleanupError) {
            console.error('채널 정리 중 오류:', cleanupError);
          }
        }, 5 * 60 * 1000); // 5분

      } catch (voiceError) {
        console.error('음성 연결 오류:', voiceError);
        // 음성 연결에 실패해도 채널은 생성된 상태로 유지
      }

      await interaction.reply({
        content: `✅ 개인 음성채널 <#${voiceChannel.id}>이 생성되었습니다!`,
        flags: MessageFlags.Ephemeral
      });

    } catch (error) {
      console.error('음성채널 생성 오류:', error);
      
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: '❌ 음성채널 생성 중 오류가 발생했습니다.',
          flags: MessageFlags.Ephemeral
        });
      }
    }
  }
};
