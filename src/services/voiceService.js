import { ChannelType, PermissionFlagsBits } from 'discord.js';
import config from '../../config.json' assert { type: 'json' };

class VoiceService {
  constructor() {
    this.activeConnections = new Map(); // channelId -> connection
    this.userChannels = new Map(); // userId -> channelId
  }

  /**
   * 사용자와 봇이 같은 음성채널에 있는지 확인
   * @param {import('discord.js').Message} message 
   * @returns {Object} 음성 상태 정보
   */
  checkVoiceStatus(message) {
    if (!message.guild) {
      return {
        valid: false,
        reason: 'DM에서는 음성채널을 확인할 수 없습니다.',
        inSameChannel: false,
        channels: { userChannel: null, botChannel: null }
      };
    }

    const user = message.author;
    const bot = message.client.user;
    const guild = message.guild;

    // 사용자 음성 상태 확인
    const userVoiceState = guild.voiceStates.cache.get(user.id);
    const userChannel = userVoiceState?.channel;

    // 봇 음성 상태 확인
    const botVoiceState = guild.voiceStates.cache.get(bot.id);
    const botChannel = botVoiceState?.channel;

    const inSameChannel = userChannel && botChannel && userChannel.id === botChannel.id;

    return {
      valid: true,
      inSameChannel,
      channels: {
        userChannel,
        botChannel
      },
      userInVoice: !!userChannel,
      botInVoice: !!botChannel
    };
  }

  /**
   * 사용자와 봇이 같은 음성채널에 있는지 간단히 확인
   * @param {import('discord.js').Message} message 
   * @returns {boolean}
   */
  areInSameVoiceChannel(message) {
    const status = this.checkVoiceStatus(message);
    return status.valid && status.inSameChannel;
  }

  /**
   * 개인 음성채널 생성
   * @param {import('discord.js').User} user 
   * @param {import('discord.js').Guild} guild 
   * @returns {Promise<import('discord.js').VoiceChannel>}
   */
  async createPrivateVoiceChannel(user, guild) {
    // 설정된 서버인지 확인
    if (guild.id !== config.settings.mainServer_id) {
      throw new Error('지정된 서버에서만 사용할 수 있습니다.');
    }

    // 카테고리 채널 가져오기
    const category = guild.channels.cache.get(config.settings.mainCategory_id);
    if (!category || category.type !== ChannelType.GuildCategory) {
      throw new Error('설정된 카테고리를 찾을 수 없습니다.');
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
      throw new Error(`이미 ${existingChannel.name} 채널이 존재합니다.`);
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
          id: guild.client.user.id, // 봇에게도 권한 부여
          allow: [
            PermissionFlagsBits.Connect,
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.Speak
          ]
        }
      ]
    });

    // 사용자별 채널 매핑 저장
    this.userChannels.set(user.id, voiceChannel.id);

    return voiceChannel;
  }

  /**
   * 봇을 음성채널에 연결
   * @param {import('discord.js').VoiceChannel} voiceChannel 
   * @param {import('discord.js').Guild} guild 
   * @returns {Promise<import('@discordjs/voice').VoiceConnection>}
   */
  async joinVoiceChannel(voiceChannel, guild) {
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

      // 연결 저장
      this.activeConnections.set(voiceChannel.id, connection);

      // 자동 정리 설정 (5분 후 빈 채널 삭제)
      this.scheduleChannelCleanup(voiceChannel, guild, connection);

      return connection;

    } catch (error) {
      console.error('음성 연결 오류:', error);
      throw error;
    }
  }

  /**
   * 음성채널 자동 정리 스케줄링
   * @param {import('discord.js').VoiceChannel} voiceChannel 
   * @param {import('discord.js').Guild} guild 
   * @param {import('@discordjs/voice').VoiceConnection} connection 
   */
  scheduleChannelCleanup(voiceChannel, guild, connection) {
    setTimeout(async () => {
      try {
        const channel = guild.channels.cache.get(voiceChannel.id);
        if (channel) {
          const members = channel.members.filter(member => !member.user.bot);
          if (members.size === 0) {
            this.leaveVoiceChannel(voiceChannel.id);
            await channel.delete();
            console.log(`🗑️ 빈 음성채널 "${voiceChannel.name}" 자동 삭제됨`);
          }
        }
      } catch (cleanupError) {
        console.error('채널 정리 중 오류:', cleanupError);
      }
    }, 5 * 60 * 1000); // 5분
  }

  /**
   * 봇을 음성채널에서 나가게 함
   * @param {string} channelId 
   */
  leaveVoiceChannel(channelId) {
    const connection = this.activeConnections.get(channelId);
    if (connection) {
      connection.destroy();
      this.activeConnections.delete(channelId);
      console.log(`🎙️ 음성채널 ${channelId}에서 연결 해제됨`);
    }
  }

  /**
   * 사용자의 개인 채널 ID 가져오기
   * @param {string} userId 
   * @returns {string|null}
   */
  getUserChannelId(userId) {
    return this.userChannels.get(userId) || null;
  }

  /**
   * 사용자의 개인 채널 매핑 제거
   * @param {string} userId 
   */
  removeUserChannel(userId) {
    this.userChannels.delete(userId);
  }

  /**
   * 모든 활성 연결 해제
   */
  disconnectAll() {
    for (const [channelId, connection] of this.activeConnections) {
      connection.destroy();
      console.log(`🎙️ 모든 음성 연결 해제: ${channelId}`);
    }
    this.activeConnections.clear();
    this.userChannels.clear();
  }

  /**
   * 활성 연결 상태 정보 가져오기
   * @returns {Object}
   */
  getStatus() {
    return {
      activeConnections: this.activeConnections.size,
      userChannels: this.userChannels.size,
      connections: Array.from(this.activeConnections.keys()),
      userMappings: Object.fromEntries(this.userChannels)
    };
  }
}

// 싱글톤 인스턴스 생성
const voiceService = new VoiceService();

export default voiceService;
export { VoiceService };
