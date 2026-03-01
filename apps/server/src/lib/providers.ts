import { createOpenAI } from "@ai-sdk/openai";
import { env } from "@boost/env/server";
import { customProvider, type Provider } from "ai";
import { createRetryable } from "ai-retry";

const openai = createOpenAI({
  apiKey: env.OPENAI_API_KEY,
});

const onModelError = (ctx: {
  current: { model: { provider: string; modelId: string } };
}) => {
  const { model } = ctx.current;
  console.error(
    `[ai] error with ${model.provider}/${model.modelId}, switching to fallback`
  );
};

const chatModel = createRetryable({
  model: openai.languageModel("gpt-5.2"),
  retries: [openai.languageModel("gpt-5-mini")],
  onError: onModelError,
});

export const provider: Provider = customProvider({
  languageModels: {
    "chat-model": chatModel,
  },
});

export { config } from "@boost/config";
