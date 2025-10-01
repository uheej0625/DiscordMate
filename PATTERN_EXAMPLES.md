# 디자인 패턴 적용 가이드

## 1. Strategy Pattern (전략 패턴)

### 현재 문제점

```javascript
// ❌ BAD: aiService.js
async generateResponse({ provider, ... }) {
  switch (provider) {
    case 'GEMINI':
      apiRequest = await buildTextPrompt(...);
      response = await callGeminiAPI(apiRequest);
      break;
    case 'OPENAI':  // 새로운 provider 추가 시
      // 여기 코드 추가해야 함
      break;
    case 'CLAUDE':  // 또 추가
      // 여기도 추가
      break;
    default:
      throw new Error(`Provider '${provider}' is not available`);
  }
  
  // 각 provider마다 다른 파싱 로직
  const responseText = response?.candidates?.[0]?.content?.parts[0].text;
  // ...
}

// generateTTS, generateDecision도 같은 패턴 반복!
```

**문제점:**
- 새 provider 추가 시 3개 메서드 모두 수정 필요
- Open-Closed Principle (OCP) 위반
- 테스트 어려움 (모든 provider를 mock해야 함)

---

### 개선안: Strategy Pattern 적용

#### Step 1: Provider 인터페이스 정의

```javascript
// src/ai/providers/AIProvider.js
/**
 * AI Provider 추상 클래스
 * 모든 AI provider는 이 인터페이스를 구현해야 함
 */
export class AIProvider {
  /**
   * 텍스트 생성
   * @param {Object} params - 생성 파라미터
   * @returns {Promise<AIResponse>}
   */
  async generateText(params) {
    throw new Error('generateText() must be implemented');
  }

  /**
   * TTS 생성
   * @param {string} text - 변환할 텍스트
   * @returns {Promise<Buffer>}
   */
  async generateTTS(text) {
    throw new Error('generateTTS() must be implemented');
  }

  /**
   * 의사결정 생성
   * @param {Object} params - 의사결정 파라미터
   * @returns {Promise<DecisionResponse>}
   */
  async generateDecision(params) {
    throw new Error('generateDecision() must be implemented');
  }

  /**
   * Provider 이름 반환
   */
  getName() {
    throw new Error('getName() must be implemented');
  }
}

/**
 * 표준 AI 응답 형식
 */
export class AIResponse {
  constructor(data) {
    this.messages = data.messages || [];
    this.thinking = data.thinking || null;
    this.metadata = {
      provider: data.provider,
      model: data.model,
      timestamp: new Date().toISOString(),
      requestData: data.requestData,
      responseData: data.responseData
    };
  }
}

export class DecisionResponse {
  constructor(decision, functionResult = null, metadata = {}) {
    this.decision = decision; // 'reply' | 'wait' | 'functionCall' | 'error'
    this.functionResult = functionResult;
    this.metadata = metadata;
  }
}
```

#### Step 2: Gemini Provider 구현

```javascript
// src/ai/providers/GeminiProvider.js
import { GoogleGenAI } from "@google/genai";
import { geminiConfig } from '../../config/gemini.js';
import { AIProvider, AIResponse, DecisionResponse } from './AIProvider.js';
import { buildTextPrompt, buildTTSPrompt, buildDecisionPrompt } from '../builders/promptBuilder.js';
import { parseModelJson } from '../../utils/json.js';
import { executeFunction } from '../utils/functionLoader.js';

export class GeminiProvider extends AIProvider {
  constructor(config = geminiConfig) {
    super();
    this.config = config;
    this.client = new GoogleGenAI({ apiKey: config.apiKey });
    this.maxRetries = 3;
    this.timeout = 30000;
  }

  getName() {
    return 'GEMINI';
  }

  /**
   * Gemini API 호출 (재시도 로직 포함)
   */
  async _callAPI(payload) {
    let lastError;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        console.log(`[${this.getName()}] API call attempt ${attempt}/${this.maxRetries}`);
        
        const response = await Promise.race([
          this.client.models.generateContent(payload),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Request timeout')), this.timeout)
          )
        ]);

        console.log(`[${this.getName()}] API call successful`);
        return response;

      } catch (error) {
        lastError = error;
        console.error(`[${this.getName()}] Error (attempt ${attempt}):`, error.message);

        const isRetryable = 
          error.code === 'UND_ERR_CONNECT_TIMEOUT' ||
          error.message.includes('timeout') ||
          error.message.includes('ECONNRESET');

        if (!isRetryable || attempt === this.maxRetries) {
          break;
        }

        const backoffDelay = Math.min(2000 * Math.pow(2, attempt - 1), 8000);
        await new Promise(resolve => setTimeout(resolve, backoffDelay));
      }
    }

    throw lastError;
  }

  /**
   * 텍스트 생성 구현
   */
  async generateText({ userId, userInput, timestamp, channelId, functionCallResults, signal }) {
    try {
      // 1. 프롬프트 빌드
      const apiRequest = await buildTextPrompt(
        userId, 
        userInput, 
        timestamp, 
        channelId, 
        functionCallResults
      );

      // 2. API 호출
      const response = await this._callAPI(apiRequest);

      // 3. 응답 파싱 (Gemini 특화)
      const responseText = response?.candidates?.[0]?.content?.parts[0].text ?? '';
      console.log(`[${this.getName()}] Raw Response:`, responseText);

      const parsed = parseModelJson(responseText);
      
      if (!parsed || !Array.isArray(parsed.messages)) {
        throw new Error('Invalid response format: messages array missing');
      }

      // 4. 표준 형식으로 반환
      return new AIResponse({
        messages: parsed.messages,
        thinking: parsed.thinking,
        provider: this.getName(),
        model: this.config.model,
        requestData: apiRequest,
        responseData: response
      });

    } catch (error) {
      console.error(`[${this.getName()}] generateText error:`, error);
      throw error;
    }
  }

  /**
   * TTS 생성 구현
   */
  async generateTTS(text) {
    try {
      const apiRequest = await buildTTSPrompt(text);
      const response = await this._callAPI(apiRequest);
      
      const data = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!data) {
        throw new Error('No audio data in response');
      }

      return Buffer.from(data, 'base64');

    } catch (error) {
      console.error(`[${this.getName()}] generateTTS error:`, error);
      throw error;
    }
  }

  /**
   * 의사결정 생성 구현
   */
  async generateDecision({ userInput, channelId, maxMessages = 2 }) {
    try {
      const apiRequest = await buildDecisionPrompt(userInput, channelId, maxMessages);
      const response = await this._callAPI(apiRequest);
      
      const responseContent = response?.candidates?.[0]?.content?.parts[0];
      console.log(`[${this.getName()}] Decision Response:`, JSON.stringify(responseContent, null, 2));

      // Function Call 처리
      let functionResult = null;
      if (responseContent?.functionCall) {
        console.log('Function Call Detected:', responseContent.functionCall);
        
        try {
          const { name, args } = responseContent.functionCall;
          functionResult = await executeFunction(name, args);
          console.log('Function Result:', functionResult);
        } catch (error) {
          console.error('Function execution error:', error);
          functionResult = `Error: ${error.message}`;
        }
      }

      // Decision 파싱
      const cleanText = (responseContent?.text || '')
        .toLowerCase()
        .replace(/[\n\r\t\s]/g, '')
        .replace(/[^\w]/g, '');
      
      let decision;
      if (cleanText === 'reply') {
        decision = 'reply';
      } else if (cleanText === 'wait') {
        decision = 'wait';
      } else if (functionResult !== null) {
        decision = 'functionCall';
      } else {
        decision = 'error';
      }

      return new DecisionResponse(decision, functionResult, {
        provider: this.getName(),
        requestData: apiRequest,
        responseData: response
      });

    } catch (error) {
      console.error(`[${this.getName()}] generateDecision error:`, error);
      throw error;
    }
  }
}
```

#### Step 3: 다른 Provider 추가 예시 (OpenAI)

```javascript
// src/ai/providers/OpenAIProvider.js
import OpenAI from 'openai';
import { AIProvider, AIResponse, DecisionResponse } from './AIProvider.js';

export class OpenAIProvider extends AIProvider {
  constructor(config) {
    super();
    this.config = config;
    this.client = new OpenAI({ apiKey: config.apiKey });
  }

  getName() {
    return 'OPENAI';
  }

  async generateText({ userId, userInput, channelId }) {
    try {
      const response = await this.client.chat.completions.create({
        model: 'gpt-4',
        messages: [
          { role: 'system', content: 'You are a helpful assistant' },
          { role: 'user', content: userInput }
        ]
      });

      const message = response.choices[0].message.content;

      return new AIResponse({
        messages: [message],
        thinking: null,
        provider: this.getName(),
        model: 'gpt-4',
        requestData: { userInput },
        responseData: response
      });

    } catch (error) {
      console.error(`[${this.getName()}] generateText error:`, error);
      throw error;
    }
  }

  async generateTTS(text) {
    // OpenAI TTS 구현
    const mp3 = await this.client.audio.speech.create({
      model: "tts-1",
      voice: "alloy",
      input: text,
    });

    return Buffer.from(await mp3.arrayBuffer());
  }

  async generateDecision({ userInput, channelId }) {
    // OpenAI 스타일의 decision 로직
    // ...
    return new DecisionResponse('reply', null);
  }
}
```

#### Step 4: AIService 리팩토링

```javascript
// src/services/aiService.js (리팩토링 후)
import { GeminiProvider } from '../ai/providers/GeminiProvider.js';
import { OpenAIProvider } from '../ai/providers/OpenAIProvider.js';
import saveWaveFile from '../utils/saveWaveFile.js';

export class AIService {
  constructor() {
    // Provider 등록 (확장 시 여기만 추가!)
    this.providers = new Map([
      ['GEMINI', new GeminiProvider()],
      ['OPENAI', new OpenAIProvider({ apiKey: process.env.OPENAI_API_KEY })],
      // 'CLAUDE': new ClaudeProvider(),  // 추가 시
      // 'COHERE': new CohereProvider(),
    ]);

    this.defaultProvider = 'GEMINI';
  }

  /**
   * Provider 가져오기
   */
  _getProvider(providerName) {
    const provider = this.providers.get(providerName);
    if (!provider) {
      const available = Array.from(this.providers.keys()).join(', ');
      throw new Error(
        `Unknown provider: ${providerName}. Available: ${available}`
      );
    }
    return provider;
  }

  /**
   * 텍스트 생성
   * ✅ 이제 switch문 없음!
   */
  async generateResponse({ provider = this.defaultProvider, ...params }) {
    const aiProvider = this._getProvider(provider);
    return await aiProvider.generateText(params);
  }

  /**
   * TTS 생성
   * ✅ 이것도 switch문 없음!
   */
  async generateTTS(provider = this.defaultProvider, text) {
    const aiProvider = this._getProvider(provider);
    const audioBuffer = await aiProvider.generateTTS(text);
    
    // 파일 저장
    const fileName = 'out.wav';
    await saveWaveFile(fileName, audioBuffer);
    
    return fileName;
  }

  /**
   * 의사결정 생성
   * ✅ 여기도 switch문 없음!
   */
  async generateDecision({ provider = this.defaultProvider, ...params }) {
    const aiProvider = this._getProvider(provider);
    return await aiProvider.generateDecision(params);
  }

  /**
   * 사용 가능한 provider 목록
   */
  getAvailableProviders() {
    return Array.from(this.providers.keys());
  }

  /**
   * Provider 동적 추가 (런타임에 추가 가능!)
   */
  registerProvider(name, provider) {
    if (this.providers.has(name)) {
      console.warn(`Provider ${name} already exists. Overwriting...`);
    }
    this.providers.set(name, provider);
  }
}

export default new AIService();
```

### ✅ Strategy Pattern의 장점

**1. Open-Closed Principle 준수**
```javascript
// ❌ BEFORE: 새 provider 추가 시 기존 코드 수정
switch (provider) {
  case 'GEMINI': ...
  case 'NEW_PROVIDER': ... // 여기 추가해야 함
}

// ✅ AFTER: 새 provider 추가 시 기존 코드 변경 없음
class NewProvider extends AIProvider {
  // 구현만 하면 됨
}
aiService.registerProvider('NEW', new NewProvider());
```

**2. 테스트 용이성**
```javascript
// Mock Provider로 테스트
class MockProvider extends AIProvider {
  async generateText() {
    return new AIResponse({ messages: ['test'] });
  }
}

const testService = new AIService();
testService.registerProvider('MOCK', new MockProvider());

// 테스트
const response = await testService.generateResponse({ 
  provider: 'MOCK',
  userInput: 'test' 
});
```

**3. Provider별 독립적인 로직**
```javascript
// Gemini는 재시도 로직
class GeminiProvider {
  maxRetries = 3;
}

// OpenAI는 스트리밍 지원
class OpenAIProvider {
  async generateTextStream() { ... }
}
```

---

## 2. Event-Driven Architecture (이벤트 기반 아키텍처)

### 🎯 **개념**
- **문제**: 컴포넌트 간 강결합 → 변경 시 연쇄 수정 필요
- **해결**: 이벤트를 통한 느슨한 결합 → 발행자는 구독자를 몰라도 됨

### 📊 **구조**
```
┌────────────┐         ┌──────────────┐         ┌────────────┐
│ Publisher  │──emit──>│ EventBus     │──notify─>│ Subscriber │
└────────────┘         └──────────────┘         └────────────┘
                              │
                              └──notify─>┌────────────┐
                                         │ Subscriber │
                                         └────────────┘
```

### 💻 **현재 코드 문제점**

```javascript
// ❌ BAD: messageHandler.js
async function runBatch(key) {
  // 1. Chatting 처리
  const genId = await chattingService.chat(channelId, userId);
  
  // 2. 결과 조회
  const gen = await generationRepository.findById(genId);
  
  // 3. 음성 처리 (강결합!)
  const sameVoiceChannel = await voiceService.getSameVoiceChannel(userId);
  if (sameVoiceChannel) {
    await voiceMode(outs.join('\n'), sameVoiceChannel);
  } else {
    // 4. 텍스트 처리 (강결합!)
    await msg.channel.send(text);
  }
}

// 문제점:
// - messageHandler가 voiceService, chattingService 모두 알아야 함
// - 새로운 출력 방식(예: 이미지) 추가 시 여기를 수정해야 함
// - 순차 처리로 인한 블로킹
```

### 개선안: Event-Driven Architecture 적용

#### Step 1: Event Bus 구현

```javascript
// src/events/EventBus.js
import { EventEmitter } from 'events';

/**
 * 중앙 이벤트 버스
 * 애플리케이션 전역에서 사용되는 싱글톤
 */
class EventBus extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(50); // 기본 10개 제한 완화
    
    // 이벤트 로깅 (디버깅용)
    this._enableLogging = process.env.NODE_ENV === 'development';
  }

  /**
   * 이벤트 발행
   */
  publish(eventName, data) {
    if (this._enableLogging) {
      console.log(`[EventBus] Publishing: ${eventName}`, data);
    }
    this.emit(eventName, data);
  }

  /**
   * 이벤트 구독
   */
  subscribe(eventName, handler) {
    if (this._enableLogging) {
      console.log(`[EventBus] Subscribing to: ${eventName}`);
    }
    this.on(eventName, handler);
  }

  /**
   * 일회성 구독
   */
  subscribeOnce(eventName, handler) {
    this.once(eventName, handler);
  }

  /**
   * 구독 해제
   */
  unsubscribe(eventName, handler) {
    this.off(eventName, handler);
  }

  /**
   * 모든 구독자 제거
   */
  unsubscribeAll(eventName) {
    this.removeAllListeners(eventName);
  }
}

// 싱글톤 인스턴스
export const eventBus = new EventBus();

/**
 * 이벤트 이름 상수 (오타 방지)
 */
export const Events = {
  // Message 관련
  MESSAGE_RECEIVED: 'message:received',
  MESSAGE_PROCESSED: 'message:processed',
  
  // Generation 관련
  GENERATION_STARTED: 'generation:started',
  GENERATION_COMPLETED: 'generation:completed',
  GENERATION_FAILED: 'generation:failed',
  GENERATION_CANCELED: 'generation:canceled',
  
  // Voice 관련
  VOICE_OUTPUT_REQUESTED: 'voice:output:requested',
  VOICE_PLAYBACK_STARTED: 'voice:playback:started',
  VOICE_PLAYBACK_COMPLETED: 'voice:playback:completed',
  VOICE_PLAYBACK_FAILED: 'voice:playback:failed',
  
  // Text 관련
  TEXT_OUTPUT_REQUESTED: 'text:output:requested',
  TEXT_MESSAGE_SENT: 'text:message:sent',
  
  // Decision 관련
  DECISION_MADE: 'decision:made',
  FUNCTION_CALLED: 'function:called',
};
```

#### Step 2: ChattingService를 Event Publisher로 변경

```javascript
// src/services/chattingService.js (리팩토링)
import messageService from '../services/messageService.js';
import aiService from '../services/aiService.js';
import generationRepository from '../repositories/generationRepository.js';
import convertToISO from '../utils/convertToISO.js';
import { GENERATION_STATUS } from '../database/schemas/generations.js';
import { eventBus, Events } from '../events/EventBus.js';

class ChattingService {
  constructor() {
    this.activeGenerations = new Map();
  }

  cancelActive(channelId, userId, reason = 'superseded-by-new-input') {
    const key = `${userId}:${channelId}`;
    const currentGeneration = this.activeGenerations.get(key);
    if (!currentGeneration) return;

    try { 
      currentGeneration.abortController?.abort(); 
    } catch {}

    try {
      generationRepository.update(currentGeneration.genId, {
        status: GENERATION_STATUS.CANCELED,
        finishedAt: convertToISO(new Date()),
        reasons: reason
      });

      // ✅ 이벤트 발행
      eventBus.publish(Events.GENERATION_CANCELED, {
        genId: currentGeneration.genId,
        channelId,
        userId,
        reason
      });

    } catch (error) {
      console.debug('Failed to cancel generation:', error.message);
    }

    this.activeGenerations.delete(key);
  }

  async chat(channelId, userId) {
    const key = `${userId}:${channelId}`;
    
    this.cancelActive(channelId, userId, 'pre-start-cancel');

    const messages = await messageService.getToProcessMessages(channelId, userId);
    if (!messages.length) return null;

    const generation = await generationRepository.create({
      messageIds: messages.map(m => m.messageId),
      userInput: messages.map(m => m.content ?? '').join('\n'),
      status: GENERATION_STATUS.PROCESSING,
      startedAt: convertToISO(new Date())
    });

    // ✅ 시작 이벤트 발행
    eventBus.publish(Events.GENERATION_STARTED, {
      genId: generation.id,
      channelId,
      userId,
      messageCount: messages.length
    });

    const abortController = new AbortController();
    this.activeGenerations.set(key, { genId: generation.id, abortController });

    try {
      // Decision 단계
      let decision = await aiService.generateDecision({
        provider: 'GEMINI',
        userInput: messages.map(m => m.content ?? '').join('\n'),
        channelId
      });

      // ✅ Decision 이벤트 발행
      eventBus.publish(Events.DECISION_MADE, {
        genId: generation.id,
        decision: decision.decision,
        functionResult: decision.functionResult
      });

      // Decision 재시도 로직
      let decisionAttempts = 1;
      let functionResults = [];

      while (decision.decision === 'wait' && decisionAttempts < 3) {
        await new Promise(resolve => setTimeout(resolve, 5000));
        decisionAttempts++;
        decision = await aiService.generateDecision({
          provider: 'GEMINI',
          userInput: messages.map(m => m.content ?? '').join('\n'),
          channelId
        });
      }

      if (decision.decision === 'functionCall' && decision.functionResult) {
        functionResults.push(decision.functionResult);
        
        // ✅ Function Call 이벤트
        eventBus.publish(Events.FUNCTION_CALLED, {
          genId: generation.id,
          functionResult: decision.functionResult
        });
      }

      // Response 생성
      const response = await aiService.generateResponse({
        provider: 'GEMINI',
        userId,
        userInput: messages.map(m => m.content ?? '').join('\n'),
        timestamp: Date.now(),
        channelId,
        functionCallResults: functionResults.length > 0 ? functionResults : null,
        signal: abortController.signal
      });

      // Staleness 체크
      const currentGeneration = this.activeGenerations.get(key);
      if (!currentGeneration || currentGeneration.genId !== generation.id) {
        await generationRepository.update(generation.id, {
          status: GENERATION_STATUS.CANCELED,
          finishedAt: convertToISO(new Date()),
          reasons: 'stale-response'
        });
        return null;
      }

      // DB 업데이트
      await generationRepository.update(generation.id, {
        aiOutput: Array.isArray(response.messages) 
          ? response.messages.join('\n') 
          : String(response.messages ?? ''),
        aiThinking: response.thinking ?? null,
        finishedAt: convertToISO(new Date()),
        apiRequest: response.apiRequest ?? null,
        apiResponse: response.apiResponse ?? null
      });

      await messageService.markProcessedByGeneration(
        messages.map(m => m.id), 
        generation.id, 
        convertToISO(new Date())
      );

      await generationRepository.update(generation.id, {
        status: GENERATION_STATUS.SUCCESS
      });

      // ✅ 완료 이벤트 발행 (가장 중요!)
      eventBus.publish(Events.GENERATION_COMPLETED, {
        genId: generation.id,
        channelId,
        userId,
        output: response.messages,
        thinking: response.thinking
      });

      return generation.id;

    } catch (error) {
      const isAborted = error && (
        error.name === 'AbortError' || 
        error.code === 'ABORT_ERR'
      );
      
      const currentGeneration = this.activeGenerations.get(key);
      if (!currentGeneration || currentGeneration.genId !== generation.id || isAborted) {
        await generationRepository.update(generation.id, {
          status: GENERATION_STATUS.CANCELED,
          finishedAt: convertToISO(new Date()),
          reasons: isAborted ? 'abort-signal' : 'replaced-during-error'
        });
      } else {
        await generationRepository.update(generation.id, {
          status: GENERATION_STATUS.FAILED,
          finishedAt: convertToISO(new Date()),
          reasons: String(error?.message ?? error)
        });

        // ✅ 실패 이벤트 발행
        eventBus.publish(Events.GENERATION_FAILED, {
          genId: generation.id,
          channelId,
          userId,
          error: error.message
        });
      }
      
      return null;

    } finally {
      const currentGeneration = this.activeGenerations.get(key);
      if (currentGeneration && currentGeneration.genId === generation.id) {
        this.activeGenerations.delete(key);
      }
    }
  }
}

export default new ChattingService();
```

#### Step 3: Subscribers (Event Handlers) 구현

```javascript
// src/handlers/OutputHandler.js
import { eventBus, Events } from '../events/EventBus.js';
import voiceService from '../services/voiceService.js';
import messageService from '../services/messageService.js';
import generationRepository from '../repositories/generationRepository.js';
import userRepository from '../repositories/userRepository.js';
import aiService from '../services/aiService.js';
import { getMessageDelay } from '../utils/messageDelay.js';
import path from 'path';

/**
 * Generation 완료 시 출력 처리 핸들러
 */
export class OutputHandler {
  constructor() {
    this.setupEventListeners();
  }

  setupEventListeners() {
    // Generation 완료 시
    eventBus.subscribe(Events.GENERATION_COMPLETED, async (data) => {
      await this.handleGenerationCompleted(data);
    });
  }

  async handleGenerationCompleted(data) {
    const { genId, channelId, userId, output } = data;

    console.log(`[OutputHandler] Processing generation: ${genId}`);

    try {
      // 1. DB에서 전체 데이터 조회
      const generation = await generationRepository.findById(genId);
      if (!generation) {
        console.error(`[OutputHandler] Generation not found: ${genId}`);
        return;
      }

      // 2. 출력 메시지 파싱
      const messages = Array.isArray(output) 
        ? output 
        : String(output ?? '').split('\n').filter(Boolean);

      // 3. 음성 채널 확인
      const voiceChannel = await voiceService.getSameVoiceChannel(userId);

      if (voiceChannel) {
        // ✅ 음성 출력 이벤트 발행
        eventBus.publish(Events.VOICE_OUTPUT_REQUESTED, {
          genId,
          channelId,
          userId,
          messages,
          voiceChannel
        });
      } else {
        // ✅ 텍스트 출력 이벤트 발행
        eventBus.publish(Events.TEXT_OUTPUT_REQUESTED, {
          genId,
          channelId,
          userId,
          messages
        });
      }

    } catch (error) {
      console.error(`[OutputHandler] Error processing generation ${genId}:`, error);
    }
  }
}

// ✅ 이제 각 출력 방식별로 독립적인 핸들러!

/**
 * 음성 출력 핸들러
 */
export class VoiceOutputHandler {
  constructor() {
    this.setupEventListeners();
  }

  setupEventListeners() {
    eventBus.subscribe(Events.VOICE_OUTPUT_REQUESTED, async (data) => {
      await this.handleVoiceOutput(data);
    });
  }

  async handleVoiceOutput(data) {
    const { genId, channelId, userId, messages, voiceChannel } = data;

    console.log(`[VoiceOutputHandler] Processing voice output for ${genId}`);

    try {
      const newMessageIds = [];

      // 1. 더미 메시지 생성 (컨텍스트용)
      for (const text of messages) {
        const cleanedText = text.replace(/\([^)]*\)/g, '').trim();
        const dummyMessage = this._makeDummyMessage(cleanedText, channelId, userId);
        await messageService.create(dummyMessage);
        newMessageIds.push(dummyMessage.id);
      }

      // 2. TTS 생성
      const fullText = messages.join('\n');
      await aiService.generateTTS('GEMINI', fullText);

      // 3. 음성 재생
      eventBus.publish(Events.VOICE_PLAYBACK_STARTED, {
        genId,
        voiceChannel: voiceChannel.id
      });

      const audioFilePath = path.join(process.cwd(), 'out.wav');
      const success = await voiceService.play(voiceChannel, audioFilePath);

      if (success) {
        eventBus.publish(Events.VOICE_PLAYBACK_COMPLETED, {
          genId,
          voiceChannel: voiceChannel.id
        });
      } else {
        throw new Error('Voice playback failed');
      }

      // 4. Generation에 메시지 ID 추가
      const generation = await generationRepository.findById(genId);
      const updatedMessageIds = [
        ...(generation.messageIds || []),
        ...newMessageIds
      ];
      await generationRepository.update(genId, { 
        messageIds: updatedMessageIds 
      });

    } catch (error) {
      console.error(`[VoiceOutputHandler] Error:`, error);
      
      eventBus.publish(Events.VOICE_PLAYBACK_FAILED, {
        genId,
        error: error.message
      });
    }
  }

  _makeDummyMessage(text, channelId, userId) {
    const bot = userRepository.findById(process.env.DISCORD_CLIENT_ID);
    return {
      id: `dummy-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
      channel: { id: channelId },
      author: {
        id: bot.id,
        username: bot.username,
        globalName: bot.globalName,
        bot: true
      },
      content: text,
    };
  }
}

/**
 * 텍스트 출력 핸들러
 */
export class TextOutputHandler {
  constructor(discordClient) {
    this.client = discordClient;
    this.setupEventListeners();
  }

  setupEventListeners() {
    eventBus.subscribe(Events.TEXT_OUTPUT_REQUESTED, async (data) => {
      await this.handleTextOutput(data);
    });
  }

  async handleTextOutput(data) {
    const { genId, channelId, messages } = data;

    console.log(`[TextOutputHandler] Processing text output for ${genId}`);

    try {
      const channel = await this.client.channels.fetch(channelId);
      if (!channel) {
        throw new Error(`Channel not found: ${channelId}`);
      }

      const newMessageIds = [];

      for (const text of messages) {
        // 타이핑 인디케이터
        await channel.sendTyping();
        
        // 자연스러운 지연
        await this._sleep(getMessageDelay(text));
        
        // 메시지 전송
        const sentMessage = await channel.send(text);
        
        // DB 저장
        await messageService.create(sentMessage);
        newMessageIds.push(sentMessage.id);

        // 이벤트 발행
        eventBus.publish(Events.TEXT_MESSAGE_SENT, {
          genId,
          messageId: sentMessage.id,
          content: text
        });
      }

      // Generation 업데이트
      const generation = await generationRepository.findById(genId);
      const updatedMessageIds = [
        ...(generation.messageIds || []),
        ...newMessageIds
      ];
      await generationRepository.update(genId, { 
        messageIds: updatedMessageIds 
      });

    } catch (error) {
      console.error(`[TextOutputHandler] Error:`, error);
    }
  }

  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

#### Step 4: MessageHandler 단순화

```javascript
// src/handler/messageHandler.js (리팩토링 후)
import { eventBus, Events } from '../events/EventBus.js';
import messageService from '../services/messageService.js';
import chattingService from '../services/chattingService.js';

const TIMEOUT_MS = 5000;
const timers = new Map();

/**
 * ✅ 이제 messageHandler는 입력 처리만 담당!
 * 출력 처리는 Event Handlers가 담당
 */
export default async function handleMessage(message) {
  if (message?.author?.bot) return;

  const userId = message?.author?.id;
  const channelId = message?.channel?.id;
  if (!userId || !channelId) return;

  const key = `${userId}:${channelId}`;

  // 1. 메시지 저장
  await messageService.create(message);

  // 2. 이벤트 발행
  eventBus.publish(Events.MESSAGE_RECEIVED, {
    messageId: message.id,
    userId,
    channelId,
    content: message.content
  });

  // 3. 기존 배치 취소
  chattingService.cancelActive(channelId, userId, 'new-input');

  // 4. 디바운스
  if (timers.get(key)?.timer) {
    clearTimeout(timers.get(key).timer);
  }
  
  timers.set(key, {
    lastMessage: message,
    timer: setTimeout(() => runBatch(key, message), TIMEOUT_MS),
  });
}

async function runBatch(key, message) {
  const entry = timers.get(key);
  if (!entry) return;
  timers.delete(key);

  const userId = message.author.id;
  const channelId = message.channel.id;

  // 타이핑 인디케이터
  await message.channel.sendTyping();

  // ✅ Generation 시작 (나머지는 이벤트로 처리!)
  await chattingService.chat(channelId, userId);
  
  // 끝! 출력은 OutputHandler가 알아서 처리
}
```

#### Step 5: 애플리케이션 초기화

```javascript
// src/main.js
import 'dotenv/config';
import client from './discord/discord.js';
import { OutputHandler, VoiceOutputHandler, TextOutputHandler } from './handlers/OutputHandler.js';
import { eventBus, Events } from './events/EventBus.js';

console.log('🤖 DiscordMate starting...');

// ✅ Event Handlers 초기화
new OutputHandler();
new VoiceOutputHandler();
new TextOutputHandler(client);

// 선택적: 로깅 핸들러
eventBus.subscribe(Events.GENERATION_COMPLETED, (data) => {
  console.log(`✅ Generation completed: ${data.genId}`);
});

eventBus.subscribe(Events.GENERATION_FAILED, (data) => {
  console.error(`❌ Generation failed: ${data.genId}`, data.error);
});

console.log('✅ Event handlers initialized');
```

### ✅ Event-Driven Architecture의 장점

**1. 낮은 결합도**
```javascript
// ❌ BEFORE: messageHandler가 모든 서비스 알아야 함
import voiceService from '../services/voiceService.js';
import chattingService from '../services/chattingService.js';
import messageService from '../services/messageService.js';

// ✅ AFTER: chattingService만 호출, 나머지는 이벤트로
await chattingService.chat(channelId, userId);
// 끝!
```

**2. 쉬운 확장**
```javascript
// 새로운 출력 방식 추가 (예: 이미지 생성)
class ImageOutputHandler {
  constructor() {
    eventBus.subscribe(Events.GENERATION_COMPLETED, async (data) => {
      if (data.shouldGenerateImage) {
        // 이미지 생성 로직
      }
    });
  }
}

// main.js에 한 줄만 추가
new ImageOutputHandler();
```

**3. 비동기 처리**
```javascript
// 여러 핸들러가 동시에 처리
eventBus.publish(Events.GENERATION_COMPLETED, data);
// → VoiceOutputHandler: 음성 생성 시작
// → LoggingHandler: 로그 저장
// → AnalyticsHandler: 통계 업데이트
// (모두 병렬로 실행!)
```

**4. 테스트 용이성**
```javascript
// Mock EventBus로 테스트
const mockEventBus = new EventEmitter();
const handler = new VoiceOutputHandler();

mockEventBus.emit(Events.VOICE_OUTPUT_REQUESTED, {
  // 테스트 데이터
});
```

---

## 3. Domain Model (도메인 모델)

### 🎯 **개념**
- **문제**: 비즈니스 로직이 서비스 계층에 흩어져 있음 → 중복, 일관성 문제
- **해결**: 도메인 객체 안에 로직 캡슐화 → 응집도 높은 코드

### 📊 **현재 문제점**

```javascript
// ❌ BAD: 비즈니스 로직이 서비스 계층에
const gen = await generationRepository.findById(genId);

// 여기저기서 이런 체크 반복
if (!gen || gen.status !== GENERATION_STATUS.SUCCESS) return;

// 출력 메시지 파싱도 여기저기서
const outs = Array.isArray(gen.aiOutput) 
  ? gen.aiOutput 
  : String(gen.aiOutput ?? '').split('\n').filter(Boolean);

// 이런 로직이 여러 파일에 중복됨!
```

### 개선안: Domain Model 적용

```javascript
// src/domain/Generation.js
import { GENERATION_STATUS } from '../database/schemas/generations.js';

/**
 * Generation 도메인 모델
 * 비즈니스 로직을 캡슐화
 */
export class Generation {
  constructor(data) {
    this.id = data.id;
    this.messageIds = Array.isArray(data.messageIds) 
      ? data.messageIds 
      : JSON.parse(data.messageIds || '[]');
    this.userInput = data.userInput;
    this._status = data.status;
    this.aiOutput = data.aiOutput;
    this.aiThinking = data.aiThinking;
    this.reasons = data.reasons;
    this.startedAt = data.startedAt;
    this.finishedAt = data.finishedAt;
    this.apiRequest = data.apiRequest;
    this.apiResponse = data.apiResponse;
    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;
  }

  // ✅ Getter: 상태 확인
  get status() {
    return this._status;
  }

  get isProcessing() {
    return this._status === GENERATION_STATUS.PROCESSING;
  }

  get isSuccessful() {
    return this._status === GENERATION_STATUS.SUCCESS;
  }

  get isFailed() {
    return this._status === GENERATION_STATUS.FAILED;
  }

  get isCanceled() {
    return this._status === GENERATION_STATUS.CANCELED;
  }

  get isCompleted() {
    return this.isSuccessful || this.isFailed || this.isCanceled;
  }

  // ✅ 비즈니스 규칙: 처리 가능 여부
  canBeProcessed() {
    return this.isSuccessful && this.aiOutput != null;
  }

  // ✅ 비즈니스 규칙: 취소 가능 여부
  canBeCanceled() {
    return this.isProcessing;
  }

  // ✅ 출력 메시지 파싱 (여기저기 중복되던 로직!)
  getOutputMessages() {
    if (!this.aiOutput) return [];

    if (Array.isArray(this.aiOutput)) {
      return this.aiOutput;
    }

    return String(this.aiOutput)
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);
  }

  // ✅ 상태 전이 메서드
  markAsProcessing() {
    if (this.isCompleted) {
      throw new Error('Cannot restart completed generation');
    }
    this._status = GENERATION_STATUS.PROCESSING;
  }

  markAsSuccess(aiOutput, aiThinking = null) {
    if (!this.isProcessing) {
      throw new Error('Can only mark processing generation as successful');
    }
    this._status = GENERATION_STATUS.SUCCESS;
    this.aiOutput = aiOutput;
    this.aiThinking = aiThinking;
    this.finishedAt = new Date().toISOString();
  }

  markAsFailed(reason) {
    if (!this.isProcessing) {
      throw new Error('Can only mark processing generation as failed');
    }
    this._status = GENERATION_STATUS.FAILED;
    this.reasons = reason;
    this.finishedAt = new Date().toISOString();
  }

  cancel(reason) {
    if (!this.canBeCanceled()) {
      throw new Error('Cannot cancel non-processing generation');
    }
    this._status = GENERATION_STATUS.CANCELED;
    this.reasons = reason;
    this.finishedAt = new Date().toISOString();
  }

  // ✅ 메시지 ID 관리
  addMessageIds(messageIds) {
    const newIds = Array.isArray(messageIds) ? messageIds : [messageIds];
    this.messageIds = [...this.messageIds, ...newIds];
  }

  hasMessages() {
    return this.messageIds.length > 0;
  }

  // ✅ 소요 시간 계산
  getDuration() {
    if (!this.startedAt || !this.finishedAt) {
      return null;
    }
    const start = new Date(this.startedAt);
    const end = new Date(this.finishedAt);
    return end - start; // milliseconds
  }

  // ✅ 디버깅용
  toString() {
    return `Generation(id=${this.id}, status=${this._status}, messages=${this.messageIds.length})`;
  }

  // ✅ DB 저장용 데이터
  toJSON() {
    return {
      id: this.id,
      messageIds: this.messageIds,
      userInput: this.userInput,
      status: this._status,
      aiOutput: this.aiOutput,
      aiThinking: this.aiThinking,
      reasons: this.reasons,
      startedAt: this.startedAt,
      finishedAt: this.finishedAt,
      apiRequest: this.apiRequest,
      apiResponse: this.apiResponse,
    };
  }
}
```

이제 다른 도메인 모델들도 만들어봅시다:

```javascript
// src/domain/Message.js
export class Message {
  constructor(data) {
    this.id = data.id || data.messageId;
    this.conversationId = data.conversationId;
    this.guildId = data.guildId;
    this.channelId = data.channelId;
    this.authorId = data.authorId;
    this.content = data.content;
    this.attachments = data.attachments || [];
    this.generationId = data.generationId;
    this.timestamp = data.timestamp;
    this.deletedAt = data.deletedAt;
    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;
  }

  // ✅ 비즈니스 규칙
  isProcessed() {
    return this.generationId != null;
  }

  isDeleted() {
    return this.deletedAt != null;
  }

  hasAttachments() {
    return this.attachments.length > 0;
  }

  isEmpty() {
    return !this.content || this.content.trim().length === 0;
  }

  // ✅ 상태 전이
  markAsProcessed(generationId) {
    if (this.isProcessed()) {
      throw new Error('Message already processed');
    }
    this.generationId = generationId;
  }

  markAsDeleted() {
    this.deletedAt = new Date().toISOString();
  }

  // ✅ 컨텐츠 처리
  getCleanContent() {
    return (this.content || '').trim();
  }

  getWordCount() {
    return this.getCleanContent().split(/\s+/).length;
  }

  toJSON() {
    return {
      messageId: this.id,
      conversationId: this.conversationId,
      guildId: this.guildId,
      channelId: this.channelId,
      authorId: this.authorId,
      content: this.content,
      attachments: this.attachments,
      generationId: this.generationId,
      timestamp: this.timestamp,
      deletedAt: this.deletedAt,
    };
  }
}
```

```javascript
// src/domain/User.js
import { USER_ROLE, USER_ACCESS } from '../database/schemas/users.js';

export class User {
  constructor(data) {
    this.id = data.id || data.userId;
    this.username = data.username;
    this.globalName = data.globalName;
    this.role = data.role;
    this.access = data.access;
    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;
  }

  // ✅ 비즈니스 규칙
  isBot() {
    return this.role === USER_ROLE.BOT;
  }

  isUser() {
    return this.role === USER_ROLE.USER;
  }

  hasAccess() {
    return this.access === USER_ACCESS.GRANTED;
  }

  canInteract() {
    return this.hasAccess() && !this.isBot();
  }

  // ✅ 상태 전이
  grantAccess() {
    this.access = USER_ACCESS.GRANTED;
  }

  revokeAccess() {
    this.access = USER_ACCESS.REVOKED;
  }

  // ✅ 디스플레이
  getDisplayName() {
    return this.globalName || this.username || 'Unknown';
  }

  toJSON() {
    return {
      userId: this.id,
      username: this.username,
      globalName: this.globalName,
      role: this.role,
      access: this.access,
    };
  }
}
```

#### Repository 수정: 도메인 모델 반환

```javascript
// src/repositories/generationRepository.js
import { Generation } from '../domain/Generation.js';
import { getDatabase } from '../database/database.js';
import { v4 as uuidv4 } from 'uuid';

class GenerationRepository {
  constructor() {
    this.db = getDatabase();
  }

  /**
   * ✅ 도메인 모델 반환!
   */
  findById(id) {
    const row = this.db.prepare(`
      SELECT * FROM generations WHERE id = ?
    `).get(id);

    if (!row) return null;

    // ✅ 도메인 모델로 변환
    return new Generation({
      ...row,
      messageIds: JSON.parse(row.message_ids_json || '[]'),
      apiRequest: row.api_request ? JSON.parse(row.api_request) : null,
      apiResponse: row.api_response ? JSON.parse(row.api_response) : null,
    });
  }

  /**
   * ✅ 도메인 모델 저장
   */
  create(generation) {
    const id = uuidv4();
    const data = generation instanceof Generation 
      ? generation.toJSON() 
      : generation;

    this.db.prepare(`
      INSERT INTO generations (
        id, status, message_ids_json, user_input, started_at
      ) VALUES (?, ?, ?, ?, ?)
    `).run(
      id,
      data.status,
      JSON.stringify(data.messageIds),
      data.userInput,
      data.startedAt
    );

    return this.findById(id);
  }

  /**
   * ✅ 도메인 모델 업데이트
   */
  update(id, updates) {
    const generation = this.findById(id);
    if (!generation) {
      throw new Error(`Generation not found: ${id}`);
    }

    // updates를 적용
    const data = { ...generation.toJSON(), ...updates };

    this.db.prepare(`
      UPDATE generations 
      SET 
        status = ?,
        message_ids_json = ?,
        ai_output = ?,
        ai_thinking = ?,
        reasons = ?,
        finished_at = ?,
        updated_at = datetime('now')
      WHERE id = ?
    `).run(
      data.status,
      JSON.stringify(data.messageIds),
      data.aiOutput,
      data.aiThinking,
      data.reasons,
      data.finishedAt,
      id
    );

    return this.findById(id);
  }
}

export default new GenerationRepository();
```

#### Service에서 도메인 모델 사용

```javascript
// src/handlers/OutputHandler.js (도메인 모델 사용)
import { Generation } from '../domain/Generation.js';

export class OutputHandler {
  async handleGenerationCompleted(data) {
    const { genId, channelId, userId } = data;

    try {
      // ✅ 도메인 모델 조회
      const generation = await generationRepository.findById(genId);
      
      if (!generation) {
        console.error(`Generation not found: ${genId}`);
        return;
      }

      // ❌ BEFORE: 이런 체크가 여기저기 중복
      // if (!gen || gen.status !== GENERATION_STATUS.SUCCESS) return;
      
      // ✅ AFTER: 도메인 모델의 메서드 사용
      if (!generation.canBeProcessed()) {
        console.log(`Generation cannot be processed: ${generation.toString()}`);
        return;
      }

      // ❌ BEFORE: 파싱 로직 중복
      // const outs = Array.isArray(gen.aiOutput) ? gen.aiOutput : ...
      
      // ✅ AFTER: 도메인 모델의 메서드 사용
      const messages = generation.getOutputMessages();

      const voiceChannel = await voiceService.getSameVoiceChannel(userId);

      if (voiceChannel) {
        eventBus.publish(Events.VOICE_OUTPUT_REQUESTED, {
          generation, // ✅ 도메인 모델 전달
          voiceChannel
        });
      } else {
        eventBus.publish(Events.TEXT_OUTPUT_REQUESTED, {
          generation, // ✅ 도메인 모델 전달
        });
      }

    } catch (error) {
      console.error(`Error processing generation:`, error);
    }
  }
}
```

### ✅ Domain Model의 장점

**1. 비즈니스 로직 중앙화**
```javascript
// ❌ BEFORE: 여기저기 중복
if (!gen || gen.status !== 'SUCCESS') { ... }
if (gen && gen.status === 'SUCCESS' && gen.aiOutput) { ... }

// ✅ AFTER: 한 곳에만
generation.canBeProcessed()
```

**2. 불변성 보장**
```javascript
// ❌ BEFORE: 직접 수정 가능
gen.status = 'FAILED'; // 위험!

// ✅ AFTER: 메서드를 통해서만
generation.markAsFailed('reason'); // 안전!
```

**3. 자가 문서화**
```javascript
// ✅ 코드만 봐도 의미 명확
if (generation.canBeCanceled()) {
  generation.cancel('user-request');
}
```

**4. 테스트 용이성**
```javascript
// 도메인 로직만 단위 테스트
const gen = new Generation({
  id: '123',
  status: 'PROCESSING',
  aiOutput: 'test'
});

gen.markAsSuccess('output', 'thinking');
assert(gen.isSuccessful());
assert(gen.canBeProcessed());
```

---

## 📝 요약

| 패턴 | 해결하는 문제 | 핵심 아이디어 |
|------|--------------|--------------|
| **Strategy Pattern** | `switch`문으로 인한 확장 어려움 | 알고리즘을 별도 클래스로 분리 |
| **Event-Driven** | 컴포넌트 간 강결합 | 이벤트를 통한 느슨한 결합 |
| **Domain Model** | 비즈니스 로직 분산 | 로직을 도메인 객체에 캡슐화 |

---

이 가이드를 참고해서 프로젝트에 적용해보시겠어요? 어떤 부분부터 시작하면 좋을지 조언해드릴 수 있습니다!
