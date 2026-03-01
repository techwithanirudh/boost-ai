import { Output, generateText, stepCountIs } from "ai";
import type { ActionDecision, StepRequest } from "@boost/validators";
import { decisionSchema } from "@boost/validators";
import { systemPrompt } from "../lib/ai/prompts/system";
import { createDecisionTools } from "../lib/ai/tools";
import { config, provider } from "../lib/providers";


export async function decideNextAction(
  input: StepRequest,
  context: { rollingSummary: string; recentHistory: string },
): Promise<ActionDecision> {
  const model = provider.languageModel("chat-model");

  const prompt = [
    `Goal: ${input.goal}`,
    `Scene: ${input.observation.scene ?? ""}`,
    `Depth: ${input.observation.depthSummary ?? ""}`,
    `FrameRef: ${input.observation.frameRef ?? ""}`,
    `RollingSummary: ${context.rollingSummary}`,
    `RecentHistory:\n${context.recentHistory || "None"}`,
    "If you need more context, call tools before finalizing output.",
    "Return one action object only.",
  ].join("\n");

  const result = await generateText({
    model,
    system: systemPrompt(),
    prompt,
    tools: createDecisionTools(input.observation),
    stopWhen: stepCountIs(config.ai.maxToolSteps),
    output: Output.object({ schema: decisionSchema }),
    temperature: 0.1,
  });

  return result.output;
}
