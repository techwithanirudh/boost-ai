import { createOpenAI } from "@ai-sdk/openai";
import { env } from "@boost/env/server";
import { customProvider, type Provider } from "ai";

const openai = createOpenAI({
  apiKey: env.OPENAI_API_KEY,
});

export const provider: Provider = customProvider({
  languageModels: {
    "chat-model": openai.languageModel("gpt-5-mini"),
    "title-model": openai.languageModel("gpt-5-mini"),
  },
});

export { config } from "@boost/config";
