import type { StepRequest } from "@boost/validators";
import { stepCountIs, ToolLoopAgent } from "ai";
import { robotPrompt as systemPrompt } from "@/lib/prompts/robot";
import { provider } from "@/lib/providers";
import { createToolSet } from "@/lib/tools";
import { successToolCall } from "./utils";

export function orchestratorAgent({ input }: { input: StepRequest }) {
  if (!input.sessionId) {
    throw new Error("session_id_required");
  }

  return new ToolLoopAgent({
    model: provider.languageModel("chat-model"),
    instructions: systemPrompt(input.goal),
    toolChoice: "required",
    tools: createToolSet(input.sessionId),
    stopWhen: [
      stepCountIs(5),
      successToolCall("forward"),
      successToolCall("backward"),
      successToolCall("turn"),
      successToolCall("stop"),
    ],
    experimental_telemetry: {
      isEnabled: true,
      functionId: "robot-orchestrator",
    },
  });
}
