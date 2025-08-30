import { ChannelType } from 'discord.js';

/**
 * 사용자와 봇이 같은 음성채널에 있는지 확인합니다
 * @param {import('discord.js').Guild} guild - Discord 서버
 * @param {string} userId - 확인할 사용자 ID
 * @param {string} botId - 봇 사용자 ID
 * @returns {Object} 확인 결과
 */
export function areInSameVoiceChannel(guild, userId, botId) {
  try {
    // 사용자의 음성 상태 확인
    const userVoiceState = guild.voiceStates.cache.get(userId);
    const botVoiceState = guild.voiceStates.cache.get(botId);

    // 둘 다 음성채널에 없는 경우
    if (!userVoiceState?.channelId || !botVoiceState?.channelId) {
      return {
        inSameChannel: false,
        userChannelId: userVoiceState?.channelId || null,
        botChannelId: botVoiceState?.channelId || null,
        userChannel: userVoiceState?.channel || null,
        botChannel: botVoiceState?.channel || null,
        reason: !userVoiceState?.channelId ? 'user_not_in_voice' : 'bot_not_in_voice'
      };
    }

    // 같은 채널에 있는지 확인
    const inSameChannel = userVoiceState.channelId === botVoiceState.channelId;

    return {
      inSameChannel,
      userChannelId: userVoiceState.channelId,
      botChannelId: botVoiceState.channelId,
      userChannel: userVoiceState.channel,
      botChannel: botVoiceState.channel,
      reason: inSameChannel ? 'in_same_channel' : 'different_channels'
    };

  } catch (error) {
    console.error('음성채널 확인 중 오류:', error);
    return {
      inSameChannel: false,
      userChannelId: null,
      botChannelId: null,
      userChannel: null,
      botChannel: null,
      reason: 'error',
      error: error.message
    };
  }
}

/**
 * 사용자가 음성채널에 있는지 확인합니다
 * @param {import('discord.js').Guild} guild - Discord 서버
 * @param {string} userId - 확인할 사용자 ID
 * @returns {Object} 확인 결과
 */
export function isUserInVoiceChannel(guild, userId) {
  try {
    const userVoiceState = guild.voiceStates.cache.get(userId);
    
    return {
      inVoiceChannel: !!userVoiceState?.channelId,
      channelId: userVoiceState?.channelId || null,
      channel: userVoiceState?.channel || null,
      channelName: userVoiceState?.channel?.name || null,
      channelType: userVoiceState?.channel?.type || null,
      isDeafened: userVoiceState?.deaf || false,
      isMuted: userVoiceState?.mute || false,
      isSelfDeafened: userVoiceState?.selfDeaf || false,
      isSelfMuted: userVoiceState?.selfMute || false
    };

  } catch (error) {
    console.error('사용자 음성 상태 확인 중 오류:', error);
    return {
      inVoiceChannel: false,
      channelId: null,
      channel: null,
      channelName: null,
      channelType: null,
      isDeafened: false,
      isMuted: false,
      isSelfDeafened: false,
      isSelfMuted: false,
      error: error.message
    };
  }
}

/**
 * 봇이 음성채널에 있는지 확인합니다
 * @param {import('discord.js').Guild} guild - Discord 서버
 * @param {string} botId - 봇 사용자 ID
 * @returns {Object} 확인 결과
 */
export function isBotInVoiceChannel(guild, botId) {
  try {
    const botVoiceState = guild.voiceStates.cache.get(botId);
    
    return {
      inVoiceChannel: !!botVoiceState?.channelId,
      channelId: botVoiceState?.channelId || null,
      channel: botVoiceState?.channel || null,
      channelName: botVoiceState?.channel?.name || null,
      channelType: botVoiceState?.channel?.type || null,
      isDeafened: botVoiceState?.deaf || false,
      isMuted: botVoiceState?.mute || false,
      isSelfDeafened: botVoiceState?.selfDeaf || false,
      isSelfMuted: botVoiceState?.selfMute || false
    };

  } catch (error) {
    console.error('봇 음성 상태 확인 중 오류:', error);
    return {
      inVoiceChannel: false,
      channelId: null,
      channel: null,
      channelName: null,
      channelType: null,
      isDeafened: false,
      isMuted: false,
      isSelfDeafened: false,
      isSelfMuted: false,
      error: error.message
    };
  }
}

/**
 * 음성채널의 멤버 수를 확인합니다 (봇 제외)
 * @param {import('discord.js').VoiceChannel} voiceChannel - 음성채널
 * @returns {Object} 멤버 정보
 */
export function getVoiceChannelMembers(voiceChannel) {
  try {
    if (!voiceChannel || voiceChannel.type !== ChannelType.GuildVoice) {
      return {
        totalMembers: 0,
        humanMembers: 0,
        botMembers: 0,
        members: [],
        humans: [],
        bots: []
      };
    }

    const allMembers = Array.from(voiceChannel.members.values());
    const humans = allMembers.filter(member => !member.user.bot);
    const bots = allMembers.filter(member => member.user.bot);

    return {
      totalMembers: allMembers.length,
      humanMembers: humans.length,
      botMembers: bots.length,
      members: allMembers,
      humans: humans,
      bots: bots
    };

  } catch (error) {
    console.error('음성채널 멤버 확인 중 오류:', error);
    return {
      totalMembers: 0,
      humanMembers: 0,
      botMembers: 0,
      members: [],
      humans: [],
      bots: [],
      error: error.message
    };
  }
}

/**
 * 간편한 확인 함수 - 메시지나 인터랙션에서 바로 사용 가능
 * @param {import('discord.js').Message|import('discord.js').Interaction} messageOrInteraction - 메시지 또는 인터랙션
 * @returns {Object} 확인 결과
 */
export function checkVoiceStatus(messageOrInteraction) {
  try {
    const guild = messageOrInteraction.guild;
    const userId = messageOrInteraction.user?.id || messageOrInteraction.author?.id;
    const botId = messageOrInteraction.client.user.id;

    if (!guild || !userId) {
      return {
        valid: false,
        reason: 'invalid_input',
        error: 'Guild 또는 User ID를 찾을 수 없습니다'
      };
    }

    const result = areInSameVoiceChannel(guild, userId, botId);
    const userStatus = isUserInVoiceChannel(guild, userId);
    const botStatus = isBotInVoiceChannel(guild, botId);

    return {
      valid: true,
      inSameChannel: result.inSameChannel,
      user: userStatus,
      bot: botStatus,
      channels: {
        userChannelId: result.userChannelId,
        botChannelId: result.botChannelId,
        userChannel: result.userChannel,
        botChannel: result.botChannel
      },
      reason: result.reason
    };

  } catch (error) {
    console.error('음성 상태 확인 중 오류:', error);
    return {
      valid: false,
      reason: 'error',
      error: error.message
    };
  }
}
