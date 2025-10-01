import { EmbedBuilder, Colors, AttachmentBuilder } from 'discord.js';
import config from '../config/index.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class LogService {
  constructor() {
    this.logChannelId = null;
    this.logGuildId = null;
    this.initialized = false;
    this.client = null;
  }

  /**
   * Discord client 설정
   * @param {Client} client - Discord.js client instance
   */
  setClient(client) {
    this.client = client;
  }

  /**
   * config.settings에서 로그 채널 정보 초기화
   */
  async initializeLogChannel() {
    try {
      if (this.initialized) return true;

      if (!this.client) {
        console.warn('⚠️ Discord client가 설정되지 않았습니다.');
        return false;
      }

      // config.settings에서 로그 채널 정보 가져오기
      this.logChannelId = config.settings?.log_channel_id;
      this.logGuildId = config.settings?.log_guild_id;

      if (!this.logChannelId || !this.logGuildId || 
          this.logChannelId === "YOUR_LOG_CHANNEL_ID_HERE" || 
          this.logGuildId === "YOUR_LOG_GUILD_ID_HERE") {
        console.warn('⚠️ config.settings에 log_channel_id 또는 log_guild_id가 올바르게 설정되지 않았습니다.');
        console.warn('⚠️ 로그 기능을 사용하려면 config.json에서 실제 채널 ID와 길드 ID를 설정해주세요.');
        return false;
      }

      // 채널 존재 여부 확인
      try {
        const logChannel = await this.client.channels.fetch(this.logChannelId);
        if (!logChannel) {
          console.error('❌ 설정된 로그 채널을 찾을 수 없습니다:', this.logChannelId);
          return false;
        }

        console.log(`✅ 로그 채널이 설정되었습니다: ${logChannel.name} (${this.logChannelId})`);
        this.initialized = true;
        return true;

      } catch (error) {
        console.error('❌ 로그 채널 접근 실패:', error.message);
        return false;
      }

    } catch (error) {
      console.error('로그 채널 초기화 중 오류:', error);
      return false;
    }
  }

  /**
   * Truncate text to fit Discord embed field limits
   * @param {string} text - Text to truncate
   * @param {number} maxLength - Maximum length (default: 1024)
   * @returns {string} Truncated text
   */
  truncateText(text, maxLength = 1024) {
    if (!text || text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
  }

  /**
   * Get log channel, initializing if needed
   * @returns {Promise<Channel|null>} Log channel or null
   */
  async getLogChannel() {
    if (!this.initialized) {
      const success = await this.initializeLogChannel();
      if (!success) return null;
    }

    const logChannel = await this.client.channels.fetch(this.logChannelId);
    if (!logChannel) {
      console.error('로그 채널을 찾을 수 없습니다:', this.logChannelId);
      return null;
    }

    return logChannel;
  }

  /**
   * Create common base fields for log embeds
   * @param {Object} data - Data for fields
   * @param {string} data.userId - User ID
   * @param {string} data.username - Username
   * @param {string} data.channelId - Channel ID
   * @param {string} [data.guildId] - Guild ID (optional)
   * @returns {Array} Array of embed fields
   */
  createBaseFields({ userId, username, channelId, guildId }) {
    return [
      {
        name: '👤 사용자',
        value: `<@${userId}> (${username})`,
        inline: true
      },
      {
        name: '📍 채널',
        value: `<#${channelId}>`,
        inline: true
      },
      {
        name: '🏠 서버',
        value: guildId ? `서버 ID: ${guildId}` : 'DM',
        inline: true
      }
    ];
  }

  /**
   * AI 응답을 임베드로 로그 채널에 기록
   * @param {Object} logData - 로그 데이터
   * @param {string} logData.userId - 사용자 ID
   * @param {string} logData.username - 사용자명
   * @param {string} logData.userInput - 사용자 입력
   * @param {string} logData.aiThinking - AI 내부 추론
   * @param {string[]} logData.aiMessages - AI 응답 메시지들
   * @param {string} logData.channelId - 원본 채널 ID
   * @param {string} logData.guildId - 서버 ID
   * @param {number} logData.processingTime - 처리 시간 (ms)
   * @param {Object} logData.apiRequest - API 요청 데이터 (선택)
   * @param {Object} logData.apiResponse - API 응답 데이터 (선택)
   */
  async logAIResponse(logData) {
    try {
      const logChannel = await this.getLogChannel();
      if (!logChannel) {
        console.warn('로그 채널이 설정되지 않아 로그를 기록할 수 없습니다.');
        return;
      }

      // 기본 정보 임베드
      const embed = new EmbedBuilder()
        .setTitle('🤖 AI 응답 로그')
        .setColor(Colors.Blue)
        .addFields(
          ...this.createBaseFields(logData),
          {
            name: '⏱️ 처리 시간',
            value: `${logData.processingTime}ms`,
            inline: true
          },
          {
            name: '📥 사용자 입력',
            value: this.truncateText(logData.userInput)
          }
        )
        .setTimestamp();

      // AI 응답 메시지들 추가
      if (logData.aiMessages && logData.aiMessages.length > 0) {
        const aiResponseText = logData.aiMessages.join(' ');
        embed.addFields({
          name: '🤖 AI 응답',
          value: this.truncateText(aiResponseText)
        });
      }

      // AI 내부 추론 추가 (있는 경우)
      if (logData.aiThinking) {
        embed.addFields({
          name: '🧠 AI 추론 과정',
          value: this.truncateText(logData.aiThinking)
        });
      }

      const embeds = [embed];
      const attachments = [];

      // API 요청/응답을 각각 별도 파일로 생성하여 첨부
      if (logData.apiRequest || logData.apiResponse) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        
        // media 디렉토리가 없으면 생성
        const mediaDir = path.join(__dirname, '../../media');
        if (!fs.existsSync(mediaDir)) {
          fs.mkdirSync(mediaDir, { recursive: true });
        }

        const filesToDelete = [];

        // API 요청 파일 생성
        if (logData.apiRequest) {
          const requestFileName = `api-request-${timestamp}.json`;
          const requestFilePath = path.join(mediaDir, requestFileName);
          
          fs.writeFileSync(requestFilePath, JSON.stringify(logData.apiRequest, null, 2), 'utf8');
          
          const requestAttachment = new AttachmentBuilder(requestFilePath, { name: requestFileName });
          attachments.push(requestAttachment);
          filesToDelete.push(requestFilePath);
        }

        // API 응답 파일 생성
        if (logData.apiResponse) {
          const responseFileName = `api-response-${timestamp}.json`;
          const responseFilePath = path.join(mediaDir, responseFileName);
          
          fs.writeFileSync(responseFilePath, JSON.stringify(logData.apiResponse, null, 2), 'utf8');
          
          const responseAttachment = new AttachmentBuilder(responseFilePath, { name: responseFileName });
          attachments.push(responseAttachment);
          filesToDelete.push(responseFilePath);
        }

        // 임베드에 첨부 파일 정보 추가
        const fileInfo = [];
        if (logData.apiRequest) fileInfo.push(`📤 API 요청 : \`api-request-${timestamp}.json\``);
        if (logData.apiResponse) fileInfo.push(`📥 API 응답 : \`api-response-${timestamp}.json\``);

        embed.addFields({
          name: '📎 첨부 파일',
          value: fileInfo.join('\n'),
          inline: false
        });

        // 파일 전송 후 삭제하는 함수
        setTimeout(() => {
          filesToDelete.forEach(filePath => {
            try {
              if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
              }
            } catch (error) {
              console.error('임시 로그 파일 삭제 실패:', error);
            }
          });
        }, 5000); // 5초 후 삭제
      }

      await logChannel.send({
        embeds,
        files: attachments
      });

    } catch (error) {
      console.error('AI 응답 로그 기록 중 오류:', error);
    }
  }

  /**
   * 에러 로그 기록
   * @param {Object} errorData - 에러 데이터
   */
  async logError(errorData) {
    try {
      const logChannel = await this.getLogChannel();
      if (!logChannel) return;

      const embed = new EmbedBuilder()
        .setTitle('❌ 에러 로그')
        .setColor(Colors.Red)
        .addFields(
          ...this.createBaseFields(errorData),
          {
            name: '🔥 에러 내용',
            value: this.truncateText(errorData.error.toString())
          }
        )
        .setTimestamp();

      await logChannel.send({ embeds: [embed] });

    } catch (error) {
      console.error('에러 로그 기록 중 오류:', error);
    }
  }
}

export const logService = new LogService();
