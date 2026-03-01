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

// ---------------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------------

/**
 * Creates a ToolLoopAgent for one robot control step.
 *
 * Flow:
 *   1. Agent optionally calls getHubHealth / getPosition for diagnostics.
 *   2. Agent calls exactly one motion tool (forward, backward, turn, stop).
 *   3. Loop terminates on successToolCall on the motion tool, or after 10 steps.
 */
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
      // Diagnostic — may be called before deciding
      getHubHealth: getHealthTool,
      getPosition: getPositionTool,
      // Motion — terminal; loop ends on first successful call
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
