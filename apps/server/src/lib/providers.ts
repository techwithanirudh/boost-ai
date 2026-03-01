import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { config } from "@boost/config/ai";
import { env } from "@boost/env/server";
import { type Provider, customProvider } from "ai";
import { createRetryable } from "ai-retry";

const google = createGoogleGenerativeAI({ apiKey: env.GOOGLE_API_KEY });

const onModelError = (ctx: {
  current: { model: { provider: string; modelId: string } };
}) => {
  const { model } = ctx.current;
  console.error(`[ai] error with ${model.provider}/${model.modelId}, switching to fallback`);
};

const chatModel = createRetryable({
  model: google.languageModel("gemini-2.5-flash"),
  retries: [google.languageModel("gemini-2.0-flash")],
  onError: onModelError,
});

export const provider: Provider = customProvider({
  languageModels: {
    "chat-model": chatModel,
  },
});

export { config };
