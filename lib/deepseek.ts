import OpenAI from "openai";

let client: OpenAI | undefined;

export function getDeepSeekClient(): OpenAI {
  if (client) return client;
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error("Assistente não configurado no servidor.");
  client = new OpenAI({ apiKey, baseURL: "https://api.deepseek.com" });
  return client;
}
