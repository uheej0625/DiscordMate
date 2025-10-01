# 리팩토링 후 파일 트리 구조

## 📁 전체 구조 개요

```
DiscordMate/
├── config.json                      # 설정 파일
├── package.json
├── README.md
├── .env                             # 환경 변수
├── .gitignore
│
├── src/
│   ├── main.js                      # 📌 애플리케이션 엔트리포인트
│   │
│   ├── domain/                      # 🆕 도메인 모델 (비즈니스 로직)
│   │   ├── index.js                 # Barrel export
│   │   ├── Generation.js            # Generation 도메인 모델
│   │   ├── Message.js               # Message 도메인 모델
│   │   ├── User.js                  # User 도메인 모델
│   │   └── valueObjects/            # 값 객체 (필요시)
│   │       ├── MessageId.js
│   │       ├── ChannelId.js
│   │       └── UserId.js
│   │
│   ├── events/                      # 🆕 이벤트 시스템
│   │   ├── EventBus.js              # 중앙 이벤트 버스
│   │   ├── EventNames.js            # 이벤트 이름 상수
│   │   └── handlers/                # 이벤트 핸들러들
│   │       ├── index.js             # 모든 핸들러 초기화
│   │       ├── GenerationHandler.js # Generation 관련 이벤트
│   │       ├── OutputHandler.js     # 출력 처리
│   │       ├── VoiceOutputHandler.js
│   │       ├── TextOutputHandler.js
│   │       └── LoggingHandler.js    # 로깅 전용 핸들러
│   │
│   ├── ai/                          # AI 관련 (Strategy Pattern 적용)
│   │   ├── AIService.js             # 🔄 AI 서비스 (단순화됨)
│   │   │
│   │   ├── providers/               # 🆕 Provider Strategy 구현체들
│   │   │   ├── index.js             # Barrel export
│   │   │   ├── AIProvider.js        # 추상 클래스 (인터페이스)
│   │   │   ├── AIResponse.js        # 표준 응답 형식
│   │   │   ├── GeminiProvider.js    # Gemini 구현체
│   │   │   ├── OpenAIProvider.js    # OpenAI 구현체 (예제)
│   │   │   └── ClaudeProvider.js    # Claude 구현체 (예제)
│   │   │
│   │   ├── builders/                # 프롬프트 빌더
│   │   │   ├── contextBuilder.js
│   │   │   └── promptBuilder.js
│   │   │
│   │   ├── functions/               # AI Functions
│   │   │   └── getCurrentTemperature.js
│   │   │
│   │   ├── prompts/                 # 프롬프트 템플릿
│   │   │   └── test/
│   │   │       ├── decision/
│   │   │       ├── text/
│   │   │       └── voice/
│   │   │
│   │   └── utils/
│   │       └── functionLoader.js
│   │
│   ├── discord/                     # Discord 관련
│   │   ├── discord.js               # Discord 클라이언트 설정
│   │   │
│   │   ├── commands/                # 슬래시 커맨드
│   │   │   ├── showInference.js
│   │   │   └── voice.js
│   │   │
│   │   └── events/                  # Discord 이벤트
│   │       ├── clientReady.js
│   │       ├── interactionCreate.js
│   │       └── messageCreate.js     # 🔄 단순화됨
│   │
│   ├── services/                    # 애플리케이션 서비스
│   │   ├── ChattingService.js       # 🔄 이벤트 발행자로 변경
│   │   ├── MessageService.js
│   │   ├── VoiceService.js
│   │   └── LogService.js
│   │
│   ├── repositories/                # 데이터 접근 계층
│   │   ├── GenerationRepository.js  # 🔄 도메인 모델 반환
│   │   ├── MessageRepository.js     # 🔄 도메인 모델 반환
│   │   ├── UserRepository.js        # 🔄 도메인 모델 반환
│   │   └── ModelRepository.js
│   │
│   ├── database/                    # 데이터베이스
│   │   ├── database.js
│   │   ├── file.db
│   │   └── schemas/
│   │       ├── index.js
│   │       ├── generations.js
│   │       ├── messages.js
│   │       ├── users.js
│   │       └── model.js
│   │
│   ├── config/                      # 설정 관리
│   │   ├── index.js
│   │   ├── discord.js
│   │   └── gemini.js
│   │
│   └── utils/                       # 유틸리티
│       ├── convertToISO.js
│       ├── json.js
│       ├── messageDelay.js
│       ├── saveWaveFile.js
│       └── templateRenderer.js
│
├── legacy/                          # 🗑️ 삭제 또는 별도 브랜치로 이동
│   └── ...
│
├── media/                           # 미디어 파일
│   └── ...                          # 🔄 로그 파일은 logs/로 이동
│
├── logs/                            # 🆕 로그 파일 (gitignore 추가)
│   ├── api-request/
│   └── api-response/
│
├── tests/                           # 🆕 테스트 코드
│   ├── unit/
│   │   ├── domain/
│   │   │   ├── Generation.test.js
│   │   │   ├── Message.test.js
│   │   │   └── User.test.js
│   │   ├── services/
│   │   └── providers/
│   │       └── GeminiProvider.test.js
│   ├── integration/
│   │   ├── chattingFlow.test.js
│   │   └── eventFlow.test.js
│   └── helpers/
│       ├── mockProvider.js
│       └── testEventBus.js
│
└── docs/                            # 🆕 문서
    ├── ARCHITECTURE.md              # 아키텍처 설명
    ├── PATTERN_EXAMPLES.md          # 패턴 예제 (현재 파일)
    └── API.md                       # API 문서
```

---

## 📊 변경 사항 상세

### 🆕 새로 추가된 폴더/파일

#### 1. `src/domain/` - 도메인 모델 계층
```
domain/
├── index.js                    # export { Generation, Message, User }
├── Generation.js               # Generation 비즈니스 로직
├── Message.js                  # Message 비즈니스 로직
└── User.js                     # User 비즈니스 로직
```

**역할:**
- 비즈니스 로직 캡슐화
- 상태 검증, 변환 로직
- 도메인 규칙 강제

**예시:**
```javascript
// src/domain/index.js
export { Generation } from './Generation.js';
export { Message } from './Message.js';
export { User } from './User.js';
```

---

#### 2. `src/events/` - 이벤트 시스템
```
events/
├── EventBus.js                 # 싱글톤 이벤트 버스
├── EventNames.js               # 이벤트 상수
└── handlers/
    ├── index.js                # 모든 핸들러 등록
    ├── GenerationHandler.js
    ├── OutputHandler.js
    ├── VoiceOutputHandler.js
    ├── TextOutputHandler.js
    └── LoggingHandler.js
```

**역할:**
- 컴포넌트 간 느슨한 결합
- 이벤트 발행/구독 관리
- 핸들러 중앙 관리

**예시:**
```javascript
// src/events/handlers/index.js
import { OutputHandler } from './OutputHandler.js';
import { VoiceOutputHandler } from './VoiceOutputHandler.js';
import { TextOutputHandler } from './TextOutputHandler.js';
import { LoggingHandler } from './LoggingHandler.js';

export function initializeEventHandlers(discordClient) {
  new OutputHandler();
  new VoiceOutputHandler();
  new TextOutputHandler(discordClient);
  new LoggingHandler();
  
  console.log('✅ Event handlers initialized');
}
```

---

#### 3. `src/ai/providers/` - Strategy Pattern
```
ai/providers/
├── index.js                    # export all providers
├── AIProvider.js               # 추상 클래스
├── AIResponse.js               # 표준 응답
├── GeminiProvider.js           # Gemini 구현
├── OpenAIProvider.js           # OpenAI 구현
└── ClaudeProvider.js           # Claude 구현
```

**역할:**
- AI Provider 추상화
- 각 Provider의 독립적 구현
- 쉬운 확장

**예시:**
```javascript
// src/ai/providers/index.js
export { AIProvider } from './AIProvider.js';
export { AIResponse, DecisionResponse } from './AIResponse.js';
export { GeminiProvider } from './GeminiProvider.js';
export { OpenAIProvider } from './OpenAIProvider.js';
export { ClaudeProvider } from './ClaudeProvider.js';
```

---

#### 4. `tests/` - 테스트 코드
```
tests/
├── unit/                       # 단위 테스트
│   ├── domain/                 # 도메인 모델 테스트
│   ├── services/               # 서비스 테스트
│   └── providers/              # Provider 테스트
├── integration/                # 통합 테스트
└── helpers/                    # 테스트 헬퍼
```

---

#### 5. `logs/` - 로그 파일 분리
```
logs/
├── api-request/
│   └── *.json
├── api-response/
│   └── *.json
└── .gitkeep

# .gitignore에 추가
logs/*.json
```

---

### 🔄 변경된 파일들

#### 1. `src/main.js` - 엔트리포인트
```javascript
// BEFORE
import client from './discord/discord.js';

// AFTER
import 'dotenv/config';
import client from './discord/discord.js';
import { initializeEventHandlers } from './events/handlers/index.js';
import { initializeDatabase } from './database/database.js';

console.log('🤖 DiscordMate starting...');

// 데이터베이스 초기화
initializeDatabase();

// 이벤트 핸들러 초기화
initializeEventHandlers(client);

console.log('✅ DiscordMate ready');
```

---

#### 2. `src/services/ChattingService.js`
```javascript
// BEFORE: 모든 로직 포함
async chat() {
  // ...
  return generation.id;
}

// AFTER: 이벤트 발행
async chat() {
  // ...
  eventBus.publish(Events.GENERATION_COMPLETED, {
    genId: generation.id,
    channelId,
    userId,
    output: response.messages
  });
  return generation.id;
}
```

---

#### 3. `src/repositories/GenerationRepository.js`
```javascript
// BEFORE: Plain Object 반환
findById(id) {
  const row = this.db.prepare(...).get(id);
  return row;
}

// AFTER: Domain Model 반환
findById(id) {
  const row = this.db.prepare(...).get(id);
  if (!row) return null;
  
  return new Generation({
    ...row,
    messageIds: JSON.parse(row.message_ids_json)
  });
}
```

---

#### 4. `src/discord/events/messageCreate.js`
```javascript
// BEFORE: 복잡한 처리 로직
export default async function(message) {
  // ... 많은 로직
}

// AFTER: 단순한 위임
import handleMessage from '../../handlers/MessageHandler.js';

export default async function(message) {
  await handleMessage(message);
}
```

---

#### 5. `src/ai/AIService.js`
```javascript
// BEFORE: switch문으로 provider 분기
async generateResponse({ provider, ... }) {
  switch (provider) {
    case 'GEMINI': ...
    case 'OPENAI': ...
  }
}

// AFTER: Strategy Pattern
constructor() {
  this.providers = new Map([
    ['GEMINI', new GeminiProvider()],
    ['OPENAI', new OpenAIProvider()],
  ]);
}

async generateResponse({ provider, ...params }) {
  const aiProvider = this._getProvider(provider);
  return await aiProvider.generateText(params);
}
```

---

## 🗑️ 삭제/이동할 파일들

### 삭제 권장
```
legacy/                         # 완전 삭제 또는 별도 브랜치
├── regacy_messageRepository.js
├── setting.js
├── test.js
└── ...

src/handler/messageHandler.js  # → src/events/handlers/로 통합
```

### 이동 권장
```
media/api-request-*.json       # → logs/api-request/
media/api-response-*.json      # → logs/api-response/

out.wav                        # → logs/ 또는 temp/
```

---

## 📝 파일별 역할 정리

### 계층별 책임

| 계층 | 폴더 | 역할 | 의존 방향 |
|------|------|------|----------|
| **Domain** | `domain/` | 비즈니스 로직, 도메인 규칙 | 독립 (아무것도 의존 안 함) |
| **Events** | `events/` | 이벤트 발행/구독, 컴포넌트 연결 | Domain 의존 |
| **Application** | `services/` | 유즈케이스, 비즈니스 플로우 | Domain, Events 의존 |
| **Infrastructure** | `repositories/`, `ai/providers/` | 외부 시스템 연결 | Domain 의존 |
| **Interface** | `discord/` | 외부 입력 처리 | Services, Events 의존 |

### 의존성 흐름
```
discord/events/messageCreate.js
    ↓
services/ChattingService.js
    ↓
repositories/GenerationRepository.js  →  domain/Generation.js
    ↓
events/EventBus.js
    ↓
events/handlers/OutputHandler.js
    ↓
services/VoiceService.js / MessageService.js
```

---

## 🎯 핵심 원칙

### 1. **단일 책임 원칙 (SRP)**
- 각 파일/클래스는 하나의 책임만
- `OutputHandler` ≠ 음성 재생
- `VoiceOutputHandler` = 음성 재생만

### 2. **의존성 역전 (DIP)**
```
❌ BAD: 상위 계층이 하위 계층 의존
Service → GeminiProvider (구체 클래스)

✅ GOOD: 상위 계층이 인터페이스 의존
Service → AIProvider (추상 클래스) ← GeminiProvider
```

### 3. **도메인 중심 설계**
```
domain/        # 가장 중요! 비즈니스 로직
  ↓
services/      # 도메인 사용
  ↓
repositories/  # 도메인 저장/조회
```

---

## 📦 패키지 구조 (선택사항)

더 큰 프로젝트로 성장하면 이렇게 모듈화:

```
DiscordMate/
├── packages/
│   ├── domain/              # 독립 패키지
│   │   └── package.json
│   ├── ai-providers/        # 독립 패키지
│   │   └── package.json
│   └── discord-bot/         # 메인 애플리케이션
│       └── package.json
└── package.json             # 루트 (workspace)
```

---

## 🚀 마이그레이션 순서

### Phase 1: Domain Model (1-2일)
1. `src/domain/` 폴더 생성
2. `Generation.js`, `Message.js`, `User.js` 작성
3. Repository 수정 (도메인 모델 반환)
4. 기존 코드에서 사용

### Phase 2: Strategy Pattern (2-3일)
1. `src/ai/providers/` 폴더 생성
2. `AIProvider.js` 추상 클래스 작성
3. `GeminiProvider.js` 리팩토링
4. `AIService.js` 단순화

### Phase 3: Event-Driven (3-5일)
1. `src/events/` 폴더 생성
2. `EventBus.js` 작성
3. `ChattingService` 이벤트 발행 추가
4. `events/handlers/` 작성
5. `messageHandler.js` 단순화
6. `main.js` 초기화 코드 추가

### Phase 4: 정리 (1일)
1. `legacy/` 삭제
2. 로그 파일 이동
3. `.gitignore` 업데이트
4. 문서 작성

---

## 💡 추가 개선 사항

### 1. Environment별 설정 분리
```
config/
├── index.js                # Config 로더
├── development.json        # 개발 환경
├── production.json         # 프로덕션
└── test.json              # 테스트 환경
```

### 2. Middleware 추가 (선택)
```
src/middleware/
├── errorHandler.js         # 에러 처리
├── rateLimiter.js         # Rate limiting
└── validator.js           # 입력 검증
```

### 3. Monitoring 추가 (선택)
```
src/monitoring/
├── metrics.js             # 성능 메트릭
├── healthCheck.js         # Health check
└── logger.js              # 구조화된 로깅
```

---

이 구조가 어떻게 보이시나요? 어떤 부분부터 시작하시겠어요?
