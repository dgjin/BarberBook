import { GoogleGenAI } from "@google/genai";

// Ideally, this is injected via build process, but for this demo environment we access it from env
const API_KEY = process.env.API_KEY || '';

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
    if (!ai) return "API Key 未配置。";

    try {
      const model = 'gemini-3-flash-preview';
      const prompt = `
        你是一位专业的发型师和理发顾问。
        用户正在寻求关于发型的建议。
        请用中文回答，保持建议简洁、时尚且适合职场环境。
        
        用户问题: "${userQuery}"
        ${context ? `上下文: ${context}` : ''}
      `;

      const response = await ai.models.generateContent({
        model: model,
        contents: prompt,
      });

      return response.text || "我现在无法生成发型建议。";
    } catch (error) {
      console.error("Gemini API Error:", error);
      return "抱歉，连接发型数据库时出现问题。";
    }
  }
};