const MIN = 200;
const MAX = 1800;

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function lengthOf(text) {
  // 한글, 이모지 포함 글자 수 세기
  return Array.from(text).length;
}

function prosodyBonusOf(text) {
  const t = text.trim();
  if (/^https?:\/\//.test(t) || /```/.test(t)) return 1000;
  if (/…|\.\.\.$/.test(t)) return 300;
  if (/\?$/.test(t)) return 350;
  if (/!$/.test(t)) return 200;
  if (/^(아니 근데|그래서|근데|솔직히)$/.test(t)) return 200;
  if (/^(ㅋㅋ+|ㅎ+|ㄷㄷ|헐|와우?|omg)$/i.test(t)) return 300;
  return 0;
}

export function getMessageDelay(text) {
  const base = 250;
  const k = 40; // ms per char
  const len = lengthOf(text);
  const prosody = prosodyBonusOf(text);
  const jitter = Math.floor(Math.random() * 150); // 0~149
  let d = base + k * len + prosody + jitter;
  if (/^(ㅋㅋ+|ㅎ+|ㄷㄷ|헐)$/.test(text.trim())) {
    d = Math.min(d, 700);
  }
  if (/^https?:\/\//.test(text) || /```/.test(text)) {
    d = Math.max(d, 800);
  }
  return clamp(d, MIN, MAX);
}
