import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { env } from "@boost/env/server";

export type ProviderRuntime = {
  providerName: "google";
  modelName: string;
  model: ReturnType<ReturnType<typeof createGoogleGenerativeAI>>;
};

export function getProviderRuntime(): ProviderRuntime {
  if (!env.GOOGLE_API_KEY) {
    throw new Error("GOOGLE_API_KEY is required when using AI provider");
  }

  const google = createGoogleGenerativeAI({ apiKey: env.GOOGLE_API_KEY });

  return {
    providerName: "google",
    modelName: env.AI_MODEL,
    model: google(env.AI_MODEL),
  };
}
