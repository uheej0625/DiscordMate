import messageService from '../services/messageService.js';
import aiService from '../services/aiService.js';
import generationRepository from '../repositories/generationRepository.js';
import convertToISO from '../utils/convertToISO.js';
import { GENERATION_STATUS } from '../database/schemas/generations.js';

// 활성 세션 관리: key = `${userId}:${channelId}`
const activeGen = new Map(); // key -> { genId, abortController }

class ChattingService {
  // 외부에서 "새 유저 메시지 도착" 시 호출해도 좋고,
  // chat 내부에서 시작 전에 cancelActive를 호출해도 됨.
  cancelActive(channelId, userId, reason = 'superseded-by-new-input') {
    const key = `${userId}:${channelId}`;
    const cur = activeGen.get(key);
    if (!cur) return;

    // 1) Abort 신호 (가능할 때)
    try { cur.abortController?.abort(); } catch {}

    // 2) DB 상태를 CANCELED 로 (이미 마감됐다면 no-op)
    generationRepository.markAsCanceled(cur.genId, {
      canceledAt: convertToISO(new Date()),
      reason
    }).catch(() => { /* 이미 SUCCESS/FAILED면 조용히 무시 */ });

    // 3) 활성 세션 해제
    activeGen.delete(key);
  }

  async chat(channelId, userId) {
    const key = `${userId}:${channelId}`;

    // (선택) 시작 전에 현재 돌아가던 배치를 취소
    // - UI/업무 플로우상, "새 입력이 들어오면 즉시 취소"를 이미 위에서 호출할 수도 있음
    this.cancelActive(channelId, userId, 'pre-start-cancel');

    // 1) 아직 처리되지 않은 유저 메시지 모으기 (text_generation_id IS NULL)
    const messages = await messageService.getToProcessMessages(channelId, userId);
    if (!messages.length) return null;

    // 2) generation 행 생성 (PROCESSING) + 스냅샷 저장
    const startedAt = Date.now();
    const gen = await generationRepository.create({
      messageIds: messages.map(m => m.id),
      userInput: messages.map(m => m.content ?? '').join('\n'),
      status: GENERATION_STATUS.PROCESSING,
      startedAt: convertToISO(new Date())
    });

    // 3) 활성 세션 등록 + AbortController 준비
    const abortController = new AbortController();
    activeGen.set(key, { genId: gen.id, abortController });

    try {
      // 4) AI 호출
      const response = await aiService.generateResponse({
        provider: 'GEMINI',
        userId,
        userInput: messages.map(m => m.content ?? '').join('\n'),
        timestamp: Date.now(),
        channelId,
        signal: abortController.signal // ← 취소 지원
      });

      // 5) 늦은 응답/취소 응답 폐기: 아직 내가 활성인가?
      const cur = activeGen.get(key);
      if (!cur || cur.genId !== gen.id) {
        // 더 이상 활성 아님 → CANCELED 처리(중복 방지: DB 측에서 idempotent 하게 구현)
        await generationRepository.markAsCanceled(gen.id, {
          canceledAt: convertToISO(new Date()),
          reason: 'stale-response'
        });
        return null;
      }

      // 6) 성공 커밋 (원자적 권장: 트랜잭션 내부)
      await generationRepository.updateAiData(gen.id, {
        aiOutput: Array.isArray(response.messages) ? response.messages.join('\n') : String(response.messages ?? ''),
        aiThinking: response.thinking ?? null,
        finishedAt: convertToISO(new Date()),
        apiProvider: response.provider ?? 'GEMINI',
        apiRequest: '[REDACTED]',   // 민감 정보는 마스킹!
        apiResponse: '[REDACTED]',
        processingTime: Date.now() - startedAt
      });

      // 메시지들에 generation 링크 (성공시에만!)
      await messageService.markProcessedByGeneration(messages.map(m => m.id), gen.id, convertToISO(new Date()));

      await generationRepository.markAsCompleted(gen.id);

      return gen.id;

    } catch (err) {
      // AbortError 또는 "이미 새 배치가 활성" → CANCELED
      const aborted = (err && (err.name === 'AbortError' || err.code === 'ABORT_ERR'));
      const cur = activeGen.get(key);
      if (!cur || cur.genId !== gen.id || aborted) {
        await generationRepository.markAsCanceled(gen.id, {
          canceledAt: convertToISO(new Date()),
          reason: aborted ? 'abort-signal' : 'replaced-during-error'
        });
      } else {
        // 진짜 실패
        await generationRepository.markAsFailed(gen.id, {
          error: String(err?.message ?? err),
          finishedAt: convertToISO(new Date())
        });
      }
      return null;

    } finally {
      // 내가 아직 활성이라면 해제
      const cur = activeGen.get(key);
      if (cur && cur.genId === gen.id) {
        activeGen.delete(key);
      }
    }
  }
}

export default new ChattingService();
