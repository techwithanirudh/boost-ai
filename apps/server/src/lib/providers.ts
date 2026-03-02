import { createOpenAI } from "@ai-sdk/openai";
import { env } from "@boost/env/server";
import { customProvider, type Provider } from "ai";
import { createWebSocketFetch } from "ai-sdk-openai-websocket-fetch";

const wsFetch = createWebSocketFetch();

const openai = createOpenAI({
  apiKey: env.OPENAI_API_KEY,
  fetch: wsFetch as unknown as typeof fetch,
});

export const provider: Provider = customProvider({
  languageModels: {
    "chat-model": openai.languageModel("gpt-5-mini"),
    "title-model": openai.languageModel("gpt-5-mini"),
  },
});
