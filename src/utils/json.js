/**
 * Extract JSON from code fence (```json ... ```)
 * @param {string} text - Text that may contain code fence
 * @returns {string} Extracted content or original text
 */
function extractFromCodeFence(text) {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  return fence ? fence[1].trim() : text;
}

/**
 * Try to extract and parse JSON object from text
 * @param {string} text - Text that may contain JSON
 * @returns {Object|null} Parsed object or null if extraction fails
 */
function tryExtractJsonObject(text) {
  const startIdx = text.indexOf('{');
  const endIdx = text.lastIndexOf('}');
  
  if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) {
    return null;
  }

  try {
    const jsonStr = text.slice(startIdx, endIdx + 1);
    return JSON.parse(jsonStr);
  } catch {
    return null;
  }
}

/**
 * Parse model output as JSON with fallback handling
 * @param {*} raw - Raw model output (object, string, etc.)
 * @returns {Object} Parsed JSON object
 * @throws {Error} If raw is neither an object nor a string
 */
export function parseModelJson(raw) {
  // Already an object, return as-is
  if (typeof raw === 'object' && raw !== null) {
    return raw;
  }

  // Must be a string to parse
  if (typeof raw !== 'string') {
    throw new Error('모델 응답이 문자열도 객체도 아님');
  }

  const trimmed = raw.trim();
  const payload = extractFromCodeFence(trimmed);

  // Try direct JSON parse
  try {
    return JSON.parse(payload);
  } catch (error) {
    // Try extracting JSON object from text
    const extracted = tryExtractJsonObject(payload);
    if (extracted) {
      return extracted;
    }
    
    // Fallback: treat as plain text
    console.warn('JSON 파싱 실패, 일반 텍스트로 처리:', payload.substring(0, 100) + '...');
    return {
      messages: [payload]
    };
  }
}
