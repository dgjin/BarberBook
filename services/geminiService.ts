
import { GoogleGenAI } from "@google/genai";

// Robust environment variable access for various build tools (Vite, CRA, Webpack)
const getEnvVar = (key: string): string => {
  // 1. Try explicit VITE_ prefix (Standard for Vite)
  try {
    // @ts-ignore
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      // @ts-ignore
      if (import.meta.env[`VITE_${key}`]) return import.meta.env[`VITE_${key}`];
      // @ts-ignore
      if (import.meta.env[key]) return import.meta.env[key];
    }
  } catch (e) {}

  // 2. Try explicit REACT_APP_ prefix (Standard for CRA)
  try {
    if (typeof process !== 'undefined' && process.env) {
      if (process.env[`REACT_APP_${key}`]) return process.env[`REACT_APP_${key}`];
      if (process.env[`VITE_${key}`]) return process.env[`VITE_${key}`];
      if (process.env[key]) return process.env[key];
    }
  } catch (e) {}

  return '';
};

// Ideally, this is injected via build process, but for this demo environment we access it from env
const API_KEY = getEnvVar('API_KEY');
// Allow configuring model from Env
const MODEL_NAME = getEnvVar('GEMINI_MODEL') || 'gemini-3-flash-preview';

let client: GoogleGenAI | null = null;

const getClient = () => {
  if (!client && API_KEY) {
    client = new GoogleGenAI({ apiKey: API_KEY });
  }
  return client;
};

export const GeminiService = {
  askStyleAdvice: async (userQuery: string, context?: string) => {
    const ai = getClient();
    if (!ai) return "API Key 未配置。请检查 VITE_API_KEY 或 API_KEY 环境变量。";

    try {
      const prompt = `
        你是一位专业的发型师和理发顾问。
        用户正在寻求关于发型的建议。
        请用中文回答，保持建议简洁、时尚且适合职场环境。
        
        用户问题: "${userQuery}"
        ${context ? `上下文: ${context}` : ''}
      `;

      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: prompt,
      });

      return response.text || "我现在无法生成发型建议。";
    } catch (error) {
      console.error("Gemini API Error:", error);
      return "抱歉，连接发型数据库时出现问题。";
    }
  }
};
