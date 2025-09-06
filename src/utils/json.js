export function parseModelJson(raw) {
  if (typeof raw === 'object' && raw !== null) return raw;

  if (typeof raw !== 'string') {
    throw new Error('모델 응답이 문자열도 객체도 아님');
  }

  const s = raw.trim();

  // 2) ```json ... ``` extract
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const payload = fence ? fence[1].trim() : s;

  // 3) 1차 JSON.parse
  try {
    return JSON.parse(payload);
  } catch(error) {
    const idx = payload.indexOf('{');
    const jdx = payload.lastIndexOf('}');
    if (idx !== -1 && jdx !== -1 && jdx > idx) {
      const guess = payload.slice(idx, jdx + 1);
      return JSON.parse(guess);
    }
    throw new Error('JSON 파싱 실패', { cause: error });
  }
}
