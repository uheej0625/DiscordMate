import { Events } from 'discord.js';
import { logService } from '../../services/logService.js';
import voiceService from '../../services/voiceService.js';

export default {
  name: Events.ClientReady,
  once: true,
  async execute(client) {
    console.log(`${client.user.username} is ready!`);
    
    // Discord client를 logService에 전달
    logService.setClient(client);
    
    // Discord client를 voiceService에 전달
    voiceService.setClient(client);
    
    // 로그 채널 초기화
    const success = await logService.initializeLogChannel();
    if (success) {
      console.log('✅ 로그 채널이 성공적으로 초기화되었습니다.');
    } else {
      console.warn('⚠️ 로그 채널 초기화에 실패했습니다. config.json의 settings를 확인해주세요.');
    }
  },
};