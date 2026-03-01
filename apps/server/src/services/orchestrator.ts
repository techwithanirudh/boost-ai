import { loadMessages, saveMessages } from "@boost/db/queries/sessions";
import type { ModelMessage, UserContent } from "ai";
import { stepCountIs, ToolLoopAgent } from "ai";
import { successToolCall } from "@/lib/agents/utils";
import { createLogger } from "@/lib/logger";
import { robotPrompt as systemPrompt } from "@/lib/prompts/robot";
import { config, provider } from "@/lib/providers";
import { createToolSet } from "@/lib/tools";
import { fetchLatestFrame } from "./frame";

const log = createLogger("orchestrator");

export async function runSession(sessionId: string, goal: string) {
  const previous = await loadMessages(sessionId, config.history.limit);

  const frame = await fetchLatestFrame();
  const userContent: UserContent = [
    { type: "image", image: frame },
    { type: "text", text: `Goal: ${goal}` },
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
      stepCountIs(15),
      successToolCall("complete"),
      successToolCall("stop"),
    ],
    onStepFinish(step) {
      const calls = step.toolCalls.map((c) => c.toolName);
      log.info(
        {
          sessionId,
          step: step.stepNumber,
          tools: calls,
          finish: step.finishReason,
          tokens: {
            in: step.usage.inputTokens,
            out: step.usage.outputTokens,
          },
        },
        `step ${step.stepNumber} — ${calls.join(", ") || "no tool calls"}`
      );
    },
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
