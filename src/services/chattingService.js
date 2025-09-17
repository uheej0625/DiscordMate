import messageService from '../services/messageService.js';
import aiService from '../services/aiService.js';
import generationRepository from '../repositories/generationRepository.js';
import convertToISO from '../utils/convertToISO.js';
import { GENERATION_STATUS } from '../database/schemas/generations.js';

// Active session management: key = `${userId}:${channelId}`
const activeGenerations = new Map(); // key -> { genId, abortController }

class ChattingService {
  // Cancel active generation when new user message arrives
  // Can be called externally or internally before starting new chat
  cancelActive(channelId, userId, reason = 'superseded-by-new-input') {
    const key = `${userId}:${channelId}`;
    const currentGeneration = activeGenerations.get(key);
    if (!currentGeneration) return;

    // 1) Send abort signal (when possible)
    try { currentGeneration.abortController?.abort(); } catch {}

    // 2) Set DB status to CANCELED (no-op if already finished)
    try {
      generationRepository.update(currentGeneration.genId, {
        status: GENERATION_STATUS.CANCELED,
        finishedAt: convertToISO(new Date()),
        reasons: reason
      });
    } catch (error) {
      // Silently ignore if already SUCCESS/FAILED or other errors
      console.debug('Failed to cancel generation:', error.message);
    }

    // 3) Remove active session
    activeGenerations.delete(key);
  }

  async chat(channelId, userId) {
    const key = `${userId}:${channelId}`;

    // (Optional) Cancel current running batch before starting
    // UI/business flow might already call this when new input arrives
    this.cancelActive(channelId, userId, 'pre-start-cancel');

    // 1) Collect unprocessed user messages (generation_id IS NULL)
    const messages = await messageService.getToProcessMessages(channelId, userId);
    if (!messages.length) return null;

    // 2) Create generation record (PROCESSING) + save snapshot
    const generation = await generationRepository.create({
      messageIds: messages.map(message => message.messageId),
      userInput: messages.map(message => message.content ?? '').join('\n'),
      status: GENERATION_STATUS.PROCESSING,
      startedAt: convertToISO(new Date())
    }); 

    // 3) Register active session + prepare AbortController
    const abortController = new AbortController();
    activeGenerations.set(key, { genId: generation.id, abortController });

    try {
      const decision = await aiService.generateDecision({
        provider: 'GEMINI',
        userInput: messages.map(message => message.content ?? '').join('\n'),
        channelId
      });

      console.log('AI Decision:', decision.response);

      // 4) Call AI service
      const response = await aiService.generateResponse({
        provider: 'GEMINI',
        userId,
        userInput: messages.map(message => message.content ?? '').join('\n'),
        timestamp: Date.now(),
        channelId,
        signal: abortController.signal // ← Cancel support
      });

      // 5) Discard late/cancelled responses: Am I still active?
      const currentGeneration = activeGenerations.get(key);
      if (!currentGeneration || currentGeneration.genId !== generation.id) {
        // No longer active → Mark as CANCELED (idempotent handling on DB side)
        await generationRepository.update(generation.id, {
          status: GENERATION_STATUS.CANCELED,
          finishedAt: convertToISO(new Date()),
          reasons: 'stale-response'
        });
        return null;
      }

      // 6) Success commit (atomic recommended: inside transaction)
      await generationRepository.update(generation.id, {
        aiOutput: Array.isArray(response.messages) ? response.messages.join('\n') : String(response.messages ?? ''),
        aiThinking: response.thinking ?? null,
        finishedAt: convertToISO(new Date()),
        apiRequest: response.apiRequest ?? null,
        apiResponse: response.apiResponse ?? null
      });

      // Link messages to generation (only on success!)
      await messageService.markProcessedByGeneration(messages.map(message => message.id), generation.id, convertToISO(new Date()));

      await generationRepository.update(generation.id, {
        status: GENERATION_STATUS.SUCCESS
      });

      return generation.id;

    } catch (error) {
      // AbortError or "new batch already active" → CANCELED
      const isAborted = (error && (error.name === 'AbortError' || error.code === 'ABORT_ERR'));
      const currentGeneration = activeGenerations.get(key);
      if (!currentGeneration || currentGeneration.genId !== generation.id || isAborted) {
        await generationRepository.update(generation.id, {
          status: GENERATION_STATUS.CANCELED,
          finishedAt: convertToISO(new Date()),
          reasons: isAborted ? 'abort-signal' : 'replaced-during-error'
        });
      } else {
        // Real failure
        await generationRepository.update(generation.id, {
          status: GENERATION_STATUS.FAILED,
          finishedAt: convertToISO(new Date()),
          reasons: String(error?.message ?? error)
        });
      }
      return null;

    } finally {
      // Release if still active
      const currentGeneration = activeGenerations.get(key);
      if (currentGeneration && currentGeneration.genId === generation.id) {
        activeGenerations.delete(key);
      }
    }
  }
}

export default new ChattingService();
