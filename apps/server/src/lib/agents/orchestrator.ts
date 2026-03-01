import type { ConversationContext } from "@boost/db/queries/chat";
import type { StepRequest } from "@boost/validators";
import { stepCountIs, ToolLoopAgent } from "ai";
import { systemPrompt } from "@/lib/prompts/system";
import { provider } from "@/lib/providers";
import {
  backwardTool,
  forwardTool,
  getHealthTool,
  getPositionTool,
  stopTool,
  turnTool,
} from "@/lib/tools";
import { successToolCall } from "./utils";

export function orchestratorAgent({
  input,
  context,
}: {
  input: StepRequest;
  context: ConversationContext;
}) {
  return new ToolLoopAgent({
    model: provider.languageModel("chat-model"),
    instructions: systemPrompt(input, context),
    toolChoice: "required",
    tools: {
      getHubHealth: getHealthTool,
      getPosition: getPositionTool,
      forward: forwardTool,
      backward: backwardTool,
      turn: turnTool,
      stop: stopTool,
    },
    stopWhen: [
      stepCountIs(10),
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
