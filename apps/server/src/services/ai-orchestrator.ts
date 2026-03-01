import { Output, generateText, stepCountIs } from "ai";
import type { ActionDecision, StepRequest } from "@boost/validators";
import { decisionSchema } from "@boost/validators";
import { AI_MAX_TOOL_STEPS } from "../lib/config";
import { createDecisionTools } from "../lib/ai/tools";
import { ROBOT_SYSTEM_PROMPT } from "../lib/ai/prompts/system";
import { getProviderRuntime } from "./providers";

export async function decideNextAction(input: StepRequest): Promise<{ decision: ActionDecision; provider: string; raw?: unknown }> {
  const result = await decideNextActionWithContext(input, {
    rollingSummary: "No prior summary.",
    recentHistory: "",
  });

  return {
    decision: result.decision,
    provider: result.provider,
    raw: result.raw,
  };
}

export async function decideNextActionWithContext(
  input: StepRequest,
  context: { rollingSummary: string; recentHistory: string },
): Promise<{ decision: ActionDecision; provider: string; raw?: unknown; toolCalls?: unknown }> {
  const runtime = getProviderRuntime();

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
    model: runtime.model,
    system: ROBOT_SYSTEM_PROMPT,
    prompt,
    tools: createDecisionTools(input.observation),
    stopWhen: stepCountIs(AI_MAX_TOOL_STEPS),
    output: Output.object({ schema: decisionSchema }),
    temperature: 0.1,
  });

  return {
    decision: result.output,
    provider: `${runtime.providerName}:${runtime.modelName}`,
    raw: result.output,
    toolCalls: (result as { steps?: unknown }).steps,
  };
}
