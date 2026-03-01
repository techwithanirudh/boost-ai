import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { config } from "@boost/config/ai";
import { customProvider } from "ai";
import { createRetryable } from "ai-retry";
import { env } from "@boost/env/server";

const google = createGoogleGenerativeAI({ apiKey: env.GOOGLE_API_KEY });

const onModelError = (context: {
  current: { model: { provider: string; modelId: string } };
}) => {
  const { model } = context.current;
  console.error(`error with model ${model.provider}/${model.modelId}, switching to next model`);
};

const chatModel = createRetryable({
  model: google.languageModel('gemini-3-flash-preview'),
  retries: [
    google.languageModel('gemini-2.5-flash'),
  ],
  onError: onModelError,
});

export const provider = customProvider({
  languageModels: {
    "chat-model": chatModel,
    "summariser-model": summariserModel,
  },
});

export { config };
