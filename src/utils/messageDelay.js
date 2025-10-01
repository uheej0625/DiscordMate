const MIN = 200;
const MAX = 1800;

// Regex patterns used across the module
const PATTERNS = {
  URL_OR_CODE: /^https?:\/\/|```/,
  SHORT_LAUGH: /^(ㅋㅋ+|ㅎ+|ㄷㄷ|헐)$/,
  EXCLAMATION_PATTERNS: /^(ㅋㅋ+|ㅎ+|ㄷㄷ|헐|와우?|omg)$/i,
  ELLIPSIS: /…|\.\.\.$/,
  QUESTION: /\?$/,
  EXCLAMATION: /!$/,
  CONVERSATION_STARTERS: /^(아니 근데|그래서|근데|솔직히)$/
};

// Delay configuration constants
const DELAY_CONFIG = {
  BASE: 250,
  MS_PER_CHAR: 40,
  MAX_JITTER: 150,
  SHORT_LAUGH_MAX: 700,
  URL_OR_CODE_MIN: 800
};

// Prosody bonus values
const PROSODY_BONUS = {
  URL_OR_CODE: 1000,
  ELLIPSIS: 300,
  QUESTION: 350,
  EXCLAMATION: 200,
  CONVERSATION_STARTER: 200,
  EXCLAMATION_PATTERN: 300
};

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function lengthOf(text) {
  // 한글, 이모지 포함 글자 수 세기
  return Array.from(text).length;
}

function prosodyBonusOf(text) {
  const t = text.trim();
  if (PATTERNS.URL_OR_CODE.test(t)) return PROSODY_BONUS.URL_OR_CODE;
  if (PATTERNS.ELLIPSIS.test(t)) return PROSODY_BONUS.ELLIPSIS;
  if (PATTERNS.QUESTION.test(t)) return PROSODY_BONUS.QUESTION;
  if (PATTERNS.EXCLAMATION.test(t)) return PROSODY_BONUS.EXCLAMATION;
  if (PATTERNS.CONVERSATION_STARTERS.test(t)) return PROSODY_BONUS.CONVERSATION_STARTER;
  if (PATTERNS.EXCLAMATION_PATTERNS.test(t)) return PROSODY_BONUS.EXCLAMATION_PATTERN;
  return 0;
}

export function getMessageDelay(text) {
  const len = lengthOf(text);
  const prosody = prosodyBonusOf(text);
  const jitter = Math.floor(Math.random() * DELAY_CONFIG.MAX_JITTER);
  let d = DELAY_CONFIG.BASE + DELAY_CONFIG.MS_PER_CHAR * len + prosody + jitter;
  
  const trimmedText = text.trim();
  
  // Cap delay for short laughs/exclamations
  if (PATTERNS.SHORT_LAUGH.test(trimmedText)) {
    d = Math.min(d, DELAY_CONFIG.SHORT_LAUGH_MAX);
  }
  
  // Ensure minimum delay for URLs and code blocks
  if (PATTERNS.URL_OR_CODE.test(trimmedText)) {
    d = Math.max(d, DELAY_CONFIG.URL_OR_CODE_MIN);
  }
  
  return clamp(d, MIN, MAX);
}
