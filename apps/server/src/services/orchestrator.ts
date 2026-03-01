import { loadMessages, saveMessages } from "@boost/db/queries/sessions";
import type { ModelMessage, UserContent } from "ai";
import { ToolLoopAgent } from "ai";
import { successToolCall } from "@/lib/agents/utils";
import { hub } from "@/lib/hub";
import { robotPrompt as systemPrompt } from "@/lib/prompts/robot";
import { config, provider } from "@/lib/providers";
import { createToolSet } from "@/lib/tools";
import { fetchLatestFrame } from "./frame";

export async function runSession(sessionId: string, goal: string) {
  const previous = await loadMessages(sessionId, config.history.limit);

  const frame = await fetchLatestFrame();
  const sensor = await getSensorContext();
  const userContent: UserContent = [
    { type: "image", image: frame },
    { type: "text", text: `Goal: ${goal}\n${sensor}` },
  ];

  const messages: ModelMessage[] = [
    ...previous,
    { role: "user", content: userContent },
  ];

  const result = await new ToolLoopAgent({
    model: provider.languageModel("chat-model"),
    instructions: systemPrompt(goal),
    toolChoice: "required",
    tools: createToolSet(sessionId),
    stopWhen: [
      successToolCall("complete"),
      successToolCall("stop"),
    ],
    experimental_telemetry: {
      isEnabled: true,
      functionId: "robot-orchestrator",
    },
  }).generate({ messages });

  await saveMessages(
    sessionId,
    [...messages, ...result.response.messages],
    config.history.limit
  );

  return result;
}

async function getSensorContext(): Promise<string> {
  const state = await hub.getState();
  if (!(state.ok && state.data)) {
    return `Sensor context unavailable (${state.error ?? "unknown_error"}).`;
  }

  const { connected, distance } = state.data;
  const distanceText =
    distance === null
      ? "distance sensor reading unavailable"
      : `distance to nearest object: ${distance.toFixed(1)} cm`;

  return `Robot details: connected=${connected}; ${distanceText}.`;
}
