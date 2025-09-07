import { ChannelType, PermissionFlagsBits } from 'discord.js';
import config from '../../config.json' assert { type: 'json' };

class VoiceService {

  /**
   * 사용자와 봇이 같은 음성채널에 있는지 확인
   * @param {import('discord.js').Message} message 
   * @returns {string|null} 같은 채널에 있으면 채널 ID, 아니면 null
   */
  isVoiceMode(message) {
    if (!message.guild) {
      return 'test'//null;
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

    // 같은 채널에 있으면 채널 ID 반환, 아니면 null
    return (userChannel && botChannel && userChannel.id === botChannel.id) 
      ? userChannel.id 
      : null;
  }


}

// 싱글톤 인스턴스 생성
export default new VoiceService();
