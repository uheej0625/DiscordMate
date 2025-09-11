import fs from 'node:fs';
import path from 'node:path';
import { joinVoiceChannel, getVoiceConnection, VoiceConnectionStatus, entersState, AudioPlayerStatus, createAudioPlayer, createAudioResource } from '@discordjs/voice';

const config = JSON.parse(fs.readFileSync(path.join(path.dirname(new URL(import.meta.url).pathname), '../../config.json'), 'utf-8'));

class VoiceService {
  constructor() {
    this.client = null; // Keep the Discord client reference
  }

  /**
   * Set Discord client instance
   * @param {import('discord.js').Client} client
   */
  setClient(client) {
    this.client = client;
  }

  /**
   * Check if the user and the bot are in the same voice channel
   * @param {string} userId - Target user ID
   * @returns {string|null} Channel ID if same, otherwise null
   */
  getSameVoiceChannel(userId) {
    try {
      if (!this.client) {
        return null;
      }

      const guild = this.client.guilds.cache.get(config.settings.mainServer_id);
      if (!guild) {
        return null;
      }

      const userVoiceState = guild.voiceStates.cache.get(userId);
      const userChannel = userVoiceState?.channel;

      const botId = this.client.user?.id;
      
      const botVoiceState = botId ? guild.voiceStates.cache.get(botId) : null;
      const botChannel = botVoiceState?.channel;

      const result = (userChannel && botChannel && userChannel.id === botChannel.id)
        ? userChannel
        : null;
        
      return result;
    } catch (error) {
      console.error('[getSameVoiceChannel] Error:', error);
      return null;
    }
  }

  /**
   * Join a voice channel.
   * Returns boolean to avoid holding the connection reference.
   * Use get() later when you need the connection.
   * @param {import('discord.js').VoiceChannel|import('discord.js').StageChannel} voiceChannel
   * @returns {Promise<boolean>}
   */
  async join(voiceChannel) {
    try {
      
      const connection = joinVoiceChannel({
        channelId: voiceChannel.id,
        guildId: voiceChannel.guild.id,
        adapterCreator: voiceChannel.guild.voiceAdapterCreator,
        selfDeaf: false,   // optional: keep listening
        selfMute: false,   // optional
      });
      
      // Wait until the connection is ready (prevents race conditions)
      // Increased timeout to 10 seconds for better reliability
      await entersState(connection, VoiceConnectionStatus.Ready, 10_000);
      
      // Optional: attach minimal lifecycle logging
      connection.on(VoiceConnectionStatus.Disconnected, async () => {
        try {
          await Promise.race([
            entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
            entersState(connection, VoiceConnectionStatus.Connecting, 5_000),
          ]);

          // Recovered
        } catch {
          connection.destroy(); // Could not recover
        }
      });

      return true;
    } catch (error) {
      console.error('[join] Error:', error);
      return false;
    }
  }

  /**
   * Get current voice connection of the guild from cache
   * @param {import('discord.js').VoiceChannel|import('discord.js').StageChannel} voiceChannel
   * @returns {import('@discordjs/voice').VoiceConnection|null}
   */
  get(voiceChannel) {
    try {
      const connection = getVoiceConnection(voiceChannel.guild.id);
      return connection ?? null;
    } catch (error) {
      console.error('[get] Error:', error);
      return null;
    }
  }

  /**
   * Leave (destroy) the voice connection
   * @param {import('discord.js').VoiceChannel|import('discord.js').StageChannel} voiceChannel
   * @returns {Promise<boolean>}
   */
  async leave(voiceChannel) {
    try {
      const connection = this.get(voiceChannel);
      if (connection) {
        connection.destroy();
        return true;
      }
      return false;
    } catch (error) {
      console.error('[leave] Error:', error);
      return false;
    }
  }

  /**
   * Play a local audio file into the given voice channel.
   * - Joins the channel if not connected.
   * - Subscribes a fresh audio player to the current connection.
   * - Unsubscribes automatically when playback ends.
   *
   * @param {import('discord.js').VoiceChannel | import('discord.js').StageChannel} voiceChannel
   * @param {string} audioFilePath - Absolute or relative path to the audio file
   * @returns {Promise<boolean>} true on playback start, false otherwise
   */
  async play(voiceChannel, audioFilePath) {
    try {
      // 0) Basic guard
      if (!voiceChannel) return false;
      if (!audioFilePath || !fs.existsSync(audioFilePath)) {
        console.error('[play] File not found:', audioFilePath);
        return false;
      }

      let connection = getVoiceConnection(voiceChannel.guild.id);
      if (!connection) {
        const joined = await this.join(voiceChannel);
        if (!joined) {
          console.error('[play] Failed to join voice channel');
          return false;
        }
        connection = getVoiceConnection(voiceChannel.guild.id);
        if (!connection) return false;
      }

      // 2) Wait until the connection is ready to send audio
      console.log('[play] Waiting for connection to be ready...');
      await entersState(connection, VoiceConnectionStatus.Ready, 10_000);
      console.log('[play] Connection is ready for audio');

      // 3) Create a player and a resource
      //    inlineVolume lets you control volume if needed (e.g., resource.volume.setVolume(0.5))
      const player = createAudioPlayer();
      const resource = createAudioResource(audioFilePath, { inlineVolume: true });

      // Optional: set default volume (1.0 = 100%)
      resource.volume?.setVolume(0.7);

      // 4) Subscribe connection to the player
      const subscription = connection.subscribe(player);
      if (!subscription) {
        console.error('[play] Subscription failed (connection may be destroyed)');
        return false;
      }

      console.log('[play] Player subscribed to connection');

      // 5) Wire up minimal lifecycle handlers
      player.once(AudioPlayerStatus.Playing, () => {
        console.log('[play] Playback started');
      });

      player.once(AudioPlayerStatus.Idle, () => {
        // Auto-unsubscribe after playback finishes to stop sending silence
        subscription.unsubscribe();
        console.log('[play] Playback ended');
      });

      player.on('error', (err) => {
        console.error('[play] AudioPlayer error:', err);
        try { subscription.unsubscribe(); } catch {}
      });

      // 6) Start playback
      console.log('[play] Starting playback...');
      player.play(resource);

      // 7) Confirm that playback actually started
      await entersState(player, AudioPlayerStatus.Playing, 3_000);
      console.log('[play] Playback confirmed');
      return true;
    } catch (error) {
      console.error('[play] Error:', error);
      return false;
    }
  }
}

export default new VoiceService();
