import { loadMessages, saveMessages } from "@boost/db/queries/sessions";
import type { StepRequest } from "@boost/validators";
import type { ModelMessage, UserContent } from "ai";
import { ToolLoopAgent, stepCountIs } from "ai";
import { systemPrompt } from "@/lib/prompts/system";
import { config, provider } from "@/lib/providers";
import {
  backwardTool,
  createCompleteSessionTool,
  forwardTool,
  getHealthTool,
  getPositionTool,
  stopTool,
  turnTool,
} from "@/lib/tools";
import { fetchLatestFrame } from "./frame";
import { successToolCall } from "@/lib/agents/utils";

function buildAgent(sessionId: string, goal: string) {
  return new ToolLoopAgent({
    model: provider.languageModel("chat-model"),
    instructions: systemPrompt(goal),
    toolChoice: "required",
    tools: {
      getHubHealth: getHealthTool,
      getPosition: getPositionTool,
      forward: forwardTool,
      backward: backwardTool,
      turn: turnTool,
      stop: stopTool,
      completeSession: createCompleteSessionTool(sessionId),
    },
    stopWhen: [
      stepCountIs(config.ai.maxToolSteps),
      successToolCall("forward"),
      successToolCall("backward"),
      successToolCall("turn"),
      successToolCall("stop"),
      successToolCall("completeSession"),
    ],
    experimental_telemetry: {
      isEnabled: true,
      functionId: "robot-orchestrator",
    },
  });
}

export async function runOrchestrator(sessionId: string, input: StepRequest) {
  const previousMessages = await loadMessages(sessionId, config.history.limit);

  const frameData = await fetchLatestFrame();
  const userContent: UserContent = [
    { type: "image", image: frameData },
    ...(input.depthMapUrl ? [{ type: "image" as const, image: new URL(input.depthMapUrl) }] : []),
    { type: "text", text: `Goal: ${input.goal}` },
  ];

  const messages: ModelMessage[] = [
    ...previousMessages,
    { role: "user", content: userContent },
  ];

  const result = await buildAgent(sessionId, input.goal).generate({ messages });

  await saveMessages(
    sessionId,
    [...previousMessages, { role: "user", content: userContent }, ...result.response.messages],
    config.history.limit,
  );

  return result;
}
