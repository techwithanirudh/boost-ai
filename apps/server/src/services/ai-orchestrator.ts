import type { ConversationContext } from "@boost/db/queries/chat";
import type { ActionDecision, StepRequest } from "@boost/validators";
import { decisionSchema } from "@boost/validators";
import { Output, generateText, stepCountIs } from "ai";
import { systemPrompt } from "@/lib/prompts/system";
import { createTools } from "@/lib/tools";
import { config, provider } from "@/lib/providers";

export interface AIResult {
  decision: ActionDecision;
  provider: string;
  toolCalls: unknown;
}

export async function decideNextAction(
  input: StepRequest,
  context: ConversationContext,
): Promise<AIResult> {
  const model = provider.languageModel("chat-model");

  const result = await generateText({
    model,
    system: systemPrompt(input, context),
    prompt: [
      `Goal: ${input.goal}`,
      `Scene: ${input.observation.scene ?? ""}`,
      `Depth: ${input.observation.depthSummary ?? ""}`,
      `FrameRef: ${input.observation.frameRef ?? ""}`,
      `RollingSummary: ${context.rollingSummary}`,
      `RecentHistory:\n${context.recentHistory || "None"}`,
      "Call diagnostic tools if needed, then output one action.",
    ].join("\n"),
    tools: createTools(),
    stopWhen: stepCountIs(config.history.limit),
    output: Output.object({ schema: decisionSchema }),
    temperature: 0.1,
  });

  return {
    decision: result.output,
    provider: "google",
    toolCalls: result.toolCalls,
  };
}
