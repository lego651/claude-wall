import axios, { type AxiosRequestConfig } from "axios";

interface Message {
  role: "system" | "user" | "assistant";
  content: string;
}

// Lazy initialization - only create when needed
let openaiConfigured = false;
let openaiOptions: AxiosRequestConfig | null = null;

const initOpenAI = () => {
  if (openaiConfigured) return;

  if (!process.env.OPENAI_API_KEY) {
    console.warn("OPENAI_API_KEY is not set");
    openaiConfigured = true;
    return;
  }

  openaiOptions = {
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
  };

  openaiConfigured = true;
};

export const sendOpenAi = async (
  messages: Message[],
  userId: string,
  max: number = 100,
  temp: number = 1
): Promise<string | null> => {
  initOpenAI();

  if (!openaiOptions) {
    console.warn("OpenAI is not configured, skipping AI request");
    return null;
  }

  const data = {
    model: "gpt-3.5-turbo",
    messages,
    temperature: temp,
    max_tokens: max,
    user: userId,
  };

  try {
    const response = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      data,
      openaiOptions
    );

    return response.data?.choices?.[0]?.message?.content || null;
  } catch (error) {
    console.error("OpenAI API error:", error);
    throw error;
  }
};
