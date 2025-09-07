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
    // JSON 객체 형태가 있는지 확인
    const idx = payload.indexOf('{');
    const jdx = payload.lastIndexOf('}');
    if (idx !== -1 && jdx !== -1 && jdx > idx) {
      try {
        const guess = payload.slice(idx, jdx + 1);
        return JSON.parse(guess);
      } catch(nestedError) {
        // JSON 객체 추출도 실패한 경우
      }
    }
    
    // JSON 파싱이 완전히 실패한 경우, 일반 텍스트로 간주하고 기본 형태로 반환
    console.warn('JSON 파싱 실패, 일반 텍스트로 처리:', payload.substring(0, 100) + '...');
    return {
      messages: [payload]
    };
  }
}
