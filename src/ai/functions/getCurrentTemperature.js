import { Type } from "@google/genai";

export const declaration = {
  name: 'getCurrentTemperature',
  description: 'Gets the current temperature for a given location.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      location: {
        type: Type.STRING,
        description: 'The city name, e.g. San Francisco',
      },
    },
    required: ['location'],
  },
};

export function getCurrentTemperature({ location }) {
  // 여기서는 실제 API 호출 대신 더미 데이터를 반환합니다.
  const dummyTemperature = 50; // 예: 50도
  return `The current temperature in ${location} is ${dummyTemperature}°C.`;
}