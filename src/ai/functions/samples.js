import { registerFunction } from './registry.js';

// 간단한 계산 함수
registerFunction(
  'add',
  '두 숫자를 더합니다',
  {
    type: 'object',
    properties: {
      a: { type: 'number', description: '첫 번째 숫자' },
      b: { type: 'number', description: '두 번째 숫자' }
    },
    required: ['a', 'b']
  },
  ({ a, b }) => {
    return { result: a + b };
  }
);

// 현재 시간 가져오기 함수
registerFunction(
  'getCurrentTime',
  '현재 시간을 반환합니다',
  {
    type: 'object',
    properties: {
      format: { 
        type: 'string', 
        description: '시간 형식 (iso, locale)',
        enum: ['iso', 'locale']
      }
    }
  },
  ({ format = 'iso' }) => {
    const now = new Date();
    const time = format === 'locale' ? now.toLocaleString('ko-KR') : now.toISOString();
    return { time };
  }
);

// 문자열 길이 확인 함수
registerFunction(
  'getStringLength',
  '문자열의 길이를 반환합니다',
  {
    type: 'object',
    properties: {
      text: { type: 'string', description: '길이를 확인할 문자열' }
    },
    required: ['text']
  },
  ({ text }) => {
    return { length: text.length };
  }
);

// 랜덤 숫자 생성 함수
registerFunction(
  'getRandomNumber',
  '지정된 범위 내에서 랜덤 숫자를 생성합니다',
  {
    type: 'object',
    properties: {
      min: { type: 'number', description: '최솟값', default: 0 },
      max: { type: 'number', description: '최댓값', default: 100 }
    }
  },
  ({ min = 0, max = 100 }) => {
    const randomNumber = Math.floor(Math.random() * (max - min + 1)) + min;
    return { number: randomNumber };
  }
);

// 간단한 인사 함수
registerFunction(
  'greet',
  '사용자에게 인사를 합니다',
  {
    type: 'object',
    properties: {
      name: { type: 'string', description: '인사할 사용자의 이름' },
      language: { 
        type: 'string', 
        description: '인사 언어',
        enum: ['ko', 'en'],
        default: 'ko'
      }
    },
    required: ['name']
  },
  ({ name, language = 'ko' }) => {
    const greetings = {
      ko: `안녕하세요, ${name}님!`,
      en: `Hello, ${name}!`
    };
    return { message: greetings[language] || greetings.ko };
  }
);

console.log('Sample functions registered successfully!');
