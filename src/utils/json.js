/**
 * 문장 부호(.?!)를 기준으로 텍스트를 분할
 * @param {string} text - 분할할 텍스트
 * @returns {Array<string>} 분할된 메시지 배열
 */
function splitBySentenceEndings(text) {
  if (typeof text !== 'string') return [String(text)];
  
  // 연속된 문장 부호는 하나로 취급하고, 그 뒤의 공백에서 분할
  // (?<=[.?!]+) : 하나 이상의 문장 부호 뒤
  // \s+ : 하나 이상의 공백
  // 또는 문장 부호 뒤에 바로 문자가 나오는 경우 분할하지 않음
  const sentences = text.split(/(?<=[.?!]+)\s+(?=[^\s])/);
  
  // 빈 문자열 제거 및 공백 정리
  return sentences
    .map(s => s.trim())
    .filter(s => s.length > 0);
}

export function parseModelJson(raw) {
  if (typeof raw === 'object' && raw !== null) {
    // 이미 객체인 경우에도 messages 배열 분할 처리
    if (raw.messages && Array.isArray(raw.messages)) {
      const splitMessages = [];
      for (const msg of raw.messages) {
        splitMessages.push(...splitBySentenceEndings(msg));
      }
      return {
        ...raw,
        messages: splitMessages
      };
    }
    return raw;
  }

  if (typeof raw !== 'string') {
    throw new Error('모델 응답이 문자열도 객체도 아님');
  }

  const s = raw.trim();

  // 2) ```json ... ``` extract
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  let payload = fence ? fence[1].trim() : s;

  // 2.5) AI가 비표준 JSON을 생성한 경우 (thinking 필드가 여러 줄로 분산된 경우) 정리
  // "thinking": "1. ... 로 시작하는 패턴을 찾아서 하나의 문자열로 합침
  payload = payload.replace(
    /"thinking":\s*"([^"]*?)"\s*,?\s*"([^"]*?)"\s*,?\s*/g,
    (match, p1, p2) => {
      // 여러 줄로 나뉜 thinking을 하나로 합침
      return `"thinking": "${p1} ${p2}",`;
    }
  );

  // messages 배열만 추출하는 더 강력한 방식
  const messagesMatch = payload.match(/"messages"\s*:\s*(\[[^\]]*\])/s);
  
  if (messagesMatch) {
    try {
      const messagesArray = JSON.parse(messagesMatch[1]);
      if (Array.isArray(messagesArray)) {
        const splitMessages = [];
        for (const msg of messagesArray) {
          splitMessages.push(...splitBySentenceEndings(msg));
        }
        
        // thinking도 추출 시도
        const thinkingMatch = payload.match(/"thinking"\s*:\s*"([^"]*)"/s);
        
        return {
          thinking: thinkingMatch ? thinkingMatch[1] : null,
          messages: splitMessages
        };
      }
    } catch (e) {
      console.warn('messages 배열 파싱 실패:', e);
    }
  }

  // 3) 표준 JSON.parse 시도
  let parsed;
  try {
    parsed = JSON.parse(payload);
  } catch(error) {
    // JSON 객체 형태가 있는지 확인
    const idx = payload.indexOf('{');
    const jdx = payload.lastIndexOf('}');
    if (idx !== -1 && jdx !== -1 && jdx > idx) {
      try {
        const guess = payload.slice(idx, jdx + 1);
        parsed = JSON.parse(guess);
      } catch(nestedError) {
        // JSON 객체 추출도 실패한 경우
      }
    }
    
    // JSON 파싱이 완전히 실패한 경우, 일반 텍스트로 간주하고 기본 형태로 반환
    if (!parsed) {
      console.warn('JSON 파싱 실패, 일반 텍스트로 처리:', payload.substring(0, 100) + '...');
      return {
        messages: splitBySentenceEndings(payload)
      };
    }
  }

  // 4) messages 배열의 각 요소를 문장 부호 기준으로 분할
  if (parsed.messages && Array.isArray(parsed.messages)) {
    const splitMessages = [];
    for (const msg of parsed.messages) {
      splitMessages.push(...splitBySentenceEndings(msg));
    }
    parsed.messages = splitMessages;
  }

  return parsed;
}
