import type { ModelMessage, UserContent } from "ai";
import { hasToolCall, stepCountIs, streamText } from "ai";
import { contextPrompt } from "@/lib/prompts/robot/context";
import { robotPrompt } from "@/lib/prompts/robot";
import { config, provider } from "@/lib/providers";
import { toolSet } from "@/lib/tools";
import { fetchDepthMap } from "./depth";
import { fetchFrame } from "./frame";

function extractMovementLog(messages: ModelMessage[]): string {
  const moves: string[] = [];
  for (const msg of messages) {
    if (msg.role !== "assistant" || !Array.isArray(msg.content)) continue;
    for (const part of msg.content) {
      if (
        typeof part !== "object" ||
        part === null ||
        (part as { type?: string }).type !== "tool-call"
      ) {
        continue;
      }
      const call = part as { toolName: string; args?: Record<string, unknown> };
      const params = call.args;
      if (call.toolName === "stop") {
        moves.push("stop");
      } else if (call.toolName === "forward" || call.toolName === "backward") {
        moves.push(`${call.toolName} ${params?.value}m`);
      } else if (call.toolName === "turn") {
        moves.push(`turn ${params?.value}°`);
      }
    }
  }
  return moves.length === 0 ? "none yet" : moves.join(" → ");
}

function stripImageContent(messages: ModelMessage[]): ModelMessage[] {
  return messages.flatMap((msg) => {
    if (msg.role !== "user" || !Array.isArray(msg.content)) return [msg];
    const filtered = msg.content.filter(
      (p) =>
        typeof p !== "object" ||
        p === null ||
        (p as { type?: string }).type !== "image"
    );
    return filtered.length > 0 ? [{ ...msg, content: filtered }] : [];
  });
}

export function createRobotStream(
  sessionId: string,
  goal: string,
  history: ModelMessage[],
  onFinish: (messages: ModelMessage[]) => Promise<void>,
  abortSignal: AbortSignal
) {
  return streamText({
    model: provider.languageModel("chat-model"),
    system: robotPrompt(goal),
    messages: history,
    tools: toolSet,
    toolChoice: "required",
    abortSignal,
    stopWhen: [
      hasToolCall("complete"),
      hasToolCall("stop"),
      stepCountIs(config.ai.maxSteps),
    ],
    prepareStep: async ({ messages }) => {
      const movementLog = extractMovementLog(messages);

      let frame: Awaited<ReturnType<typeof fetchFrame>> | null = null;
      try {
        frame = await fetchFrame();
      } catch {
        return {
          messages: [
            ...messages,
            {
              role: "user" as const,
              content: `${contextPrompt(goal, movementLog, false)}\nCamera unavailable. Continue with caution.`,
            },
          ],
        };
      }

      const depthMap = await fetchDepthMap(frame.buffer).catch(() => null);
      const hasDepth = depthMap !== null;

      const userContent: UserContent = [
        { type: "image", image: frame.dataUrl },
        ...(hasDepth
          ? ([
              { type: "image", image: depthMap as string },
            ] satisfies UserContent)
          : ([] satisfies UserContent)),
        { type: "text", text: contextPrompt(goal, movementLog, hasDepth) },
      ];

      return {
        messages: [...messages, { role: "user" as const, content: userContent }],
      };
    },
    onFinish: async ({ response }) => {
      const allMessages = stripImageContent([...history, ...response.messages]);
      await onFinish(allMessages);
    },
  });
}
