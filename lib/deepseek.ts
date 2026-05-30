import OpenAI from "openai";

if (!process.env.DEEPSEEK_API_KEY) {
  throw new Error("Missing DEEPSEEK_API_KEY environment variable");
}

const deepseek = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: "https://api.deepseek.com",
});

export default deepseek;