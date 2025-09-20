import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 동적으로 functions 폴더의 모든 함수 declarations 로드
 * @returns {Promise<Array>} 함수 선언 배열
 */
export async function loadFunctionDeclarations() {
  const functionsDir = path.join(__dirname, '../functions'); // functions 폴더 경로
  const functionDeclarations = [];
  
  try {
    const files = fs.readdirSync(functionsDir)
      .filter(file => file.endsWith('.js'));
    
    for (const file of files) {
      try {
        const modulePath = path.join(functionsDir, file);
        const functionModule = await import(`file://${modulePath}`);
        
        // 새로운 구조: declaration export를 찾아서 사용
        if (functionModule.declaration) {
          functionDeclarations.push(functionModule.declaration);
        }
        // 기존 구조 호환성: default export도 지원
        else if (functionModule.default) {
          functionDeclarations.push(functionModule.default);
        }
      } catch (error) {
        console.warn(`Failed to load function from ${file}:`, error.message);
      }
    }
  } catch (error) {
    console.warn('Failed to read functions directory:', error.message);
  }
  
  return functionDeclarations;
}

// 함수 레지스트리 캐시
let functionRegistryCache = null;

/**
 * 함수 실행 (레지스트리 로드 및 실행을 한 번에 처리)
 * @param {string} functionName - 실행할 함수 이름
 * @param {Object} args - 함수 인자
 * @returns {Promise<any>} 함수 실행 결과
 */
export async function executeFunction(functionName, args) {
  // 캐시된 레지스트리가 없으면 로드
  if (!functionRegistryCache) {
    const functionsDir = path.join(__dirname, '../functions');
    functionRegistryCache = new Map();
    
    try {
      const files = fs.readdirSync(functionsDir)
        .filter(file => file.endsWith('.js'));
      
      for (const file of files) {
        try {
          const modulePath = path.join(functionsDir, file);
          const functionModule = await import(`file://${modulePath}`);
          
          // declaration이 있고 같은 이름의 함수가 있으면 레지스트리에 등록
          if (functionModule.declaration && functionModule[functionModule.declaration.name]) {
            functionRegistryCache.set(functionModule.declaration.name, functionModule[functionModule.declaration.name]);
          }
        } catch (error) {
          console.warn(`Failed to load function implementation from ${file}:`, error.message);
        }
      }
    } catch (error) {
      console.warn('Failed to read functions directory for registry:', error.message);
    }
  }

  // 함수 실행
  const func = functionRegistryCache.get(functionName);
  
  if (!func) {
    throw new Error(`Function '${functionName}' not found in registry`);
  }
  
  return await func(args);
}

/**
 * 레지스트리 캐시 초기화 (개발 중 함수 변경 시 사용)
 */
export function clearFunctionRegistryCache() {
  functionRegistryCache = null;
}