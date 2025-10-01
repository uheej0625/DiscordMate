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

  /**
   * Generate AI decision with retry logic for 'wait' responses
   * @param {Object} params - Decision parameters
   * @param {string} params.userInput - User input text
   * @param {string} params.channelId - Channel ID
   * @param {number} maxRetries - Maximum number of retries (default: 2)
   * @returns {Promise<Object>} Decision object with functionResults
   */
  async generateDecisionWithRetry({ userInput, channelId }, maxRetries = 2) {
    const RETRY_DELAY_MS = 5000;
    const functionResults = [];

    let decision = await aiService.generateDecision({
      provider: 'GEMINI',
      userInput,
      channelId
    });

    console.log('AI Decision (1st attempt):', decision);

    // Retry logic for 'wait' decisions
    for (let attempt = 1; attempt <= maxRetries && decision.decision === 'wait'; attempt++) {
      const attemptSuffix = attempt === 1 ? 'nd' : 'rd';
      console.log(`Waiting ${RETRY_DELAY_MS / 1000} seconds before retry (attempt ${attempt}/${maxRetries})...`);
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
      
      decision = await aiService.generateDecision({
        provider: 'GEMINI',
        userInput,
        channelId
      });

      console.log(`AI Decision (${attempt + 1}${attemptSuffix} attempt):`, decision);
    }

    // Collect function call results
    if (decision.decision === 'functionCall' && decision.functionResult) {
      functionResults.push(decision.functionResult);
      console.log('Function executed, proceeding with response generation...');
    }

    // Final wait handling
    if (decision.decision === 'wait' && maxRetries >= 2) {
      console.log('Final wait decision - proceeding anyway after 5 seconds...');
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
    }

    return { decision, functionResults };
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
      const userInput = messages.map(message => message.content ?? '').join('\n');
      
      // Generate decision with retry logic
      const { decision, functionResults } = await this.generateDecisionWithRetry({
        userInput,
        channelId
      });

      // 4) Call AI service
      const response = await aiService.generateResponse({
        provider: 'GEMINI',
        userId,
        userInput,
        timestamp: Date.now(),
        channelId,
        functionCallResults: functionResults.length > 0 ? functionResults : null,
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
