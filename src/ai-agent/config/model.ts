import { ChatMistralAI, type ChatMistralAIInput } from "@langchain/mistralai";
import { env } from "./env.ts";

export interface ModelOptions {
  model?: string;
  temperature?: number;
  maxRetries?: number;
  apiKey?: string;
}

export function createChatModel(options: ModelOptions = {}): ChatMistralAI {
  const config: Partial<ChatMistralAIInput> = {
    model: options.model || "open-mistral-7b",
    temperature: options.temperature ?? 0,
    maxRetries: options.maxRetries ?? 3,
    apiKey: options.apiKey || env.MISTRAL_API_KEY,
  };

  return new ChatMistralAI(config);
}

// Default conversational chat model
export const model = createChatModel();

// Multimodal vision model (Pixtral) for image analysis
export const visionModel = new ChatMistralAI({
  model: "pixtral-12b-2409",
  temperature: 0,
  apiKey: env.MISTRAL_API_KEY,
});
