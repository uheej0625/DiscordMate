import axios from "axios";
import { geminiConfig } from "../../config/custom.js";

// API URL은 환경변수 또는 config에서 불러오세요.
const CUSTOM_API_URL = process.env.CUSTOM_API_URL || "https://your-api-url.com/api";

export async function callCustomAPI(prompt) {
  try {
    const response = await axios.post(
      CUSTOM_API_URL,
      {
        model: geminiConfig.model,
        userInput: prompt.userInput,
      },
      {
        headers: {
          Authorization: `Bearer ${geminiConfig.apiKey}`,
          "Content-Type": "application/json",
        },
      }
    );
    return response.data;
  } catch (error) {
    // 에러 핸들링
    return { error: error?.response?.data || error.message };
  }
}