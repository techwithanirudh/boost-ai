import { loadMessages, saveMessages } from "@boost/db/queries/sessions";
import type { ModelMessage, UserContent } from "ai";
import { stepCountIs, ToolLoopAgent } from "ai";
import { successToolCall } from "@/lib/agents/utils";
import { robotPrompt as systemPrompt } from "@/lib/prompts/robot";
import { contextPrompt } from "@/lib/prompts/robot/context";
import { config, provider } from "@/lib/providers";
import { createToolSet } from "@/lib/tools";
import { fetchDepthMap } from "./depth";
import { fetchFrame } from "./frame";

interface RunSessionResult {
  steps: unknown[];
  text: string;
}

interface ToolCallPart {
  args?: Record<string, unknown>;
  input?: Record<string, unknown>;
  toolName: string;
  type: "tool-call";
}

function isToolCallPart(part: unknown): part is ToolCallPart {
  return (
    typeof part === "object" &&
    part !== null &&
    (part as { type?: string }).type === "tool-call"
  );
}

function formatMove(call: ToolCallPart): string | null {
  if (call.toolName === "stop") {
    return "stop";
  }
  const params = call.args ?? call.input;
  const val = params?.value as number | undefined;
  if (call.toolName === "turn") {
    return `turn ${val}°`;
  }
  if (call.toolName === "forward" || call.toolName === "backward") {
    return `${call.toolName} ${val}m`;
  }
  return null;
}

function extractMovementLog(messages: ModelMessage[]): string {
  const moves: string[] = [];

  for (const msg of messages) {
    if (msg.role !== "assistant" || !Array.isArray(msg.content)) {
      continue;
    }
    for (const part of msg.content) {
      if (!isToolCallPart(part)) {
        continue;
      }
      const move = formatMove(part as unknown as ToolCallPart);
      if (move !== null) {
        moves.push(move);
      }
    }
  }

  return moves.length === 0 ? "none yet" : moves.join(" → ");
}

async function buildMessage(
  goal: string,
  messages: ModelMessage[]
): Promise<ModelMessage> {
  const movementLog = extractMovementLog(messages);

  let frame: Awaited<ReturnType<typeof fetchFrame>> | null = null;
  try {
    frame = await fetchFrame();
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return {
      role: "user",
      content: [
        {
          type: "text",
          text: `${contextPrompt(goal, movementLog, false)}\nCamera unavailable (${msg}). Continue with caution.`,
        },
      ],
    };
  }

  const depthMap = await fetchDepthMap(frame.buffer).catch(() => null);
  const hasDepth = depthMap !== null;

  const userContent: UserContent = [
    { type: "image", image: frame.dataUrl },
    ...(hasDepth
      ? ([{ type: "image", image: depthMap as string }] satisfies UserContent)
      : ([] satisfies UserContent)),
    { type: "text", text: contextPrompt(goal, movementLog, hasDepth) },
  ];

  return { role: "user", content: userContent };
}

export async function runSession(
  sessionId: string,
  goal: string
): Promise<RunSessionResult> {
  const previous = await loadMessages(sessionId, config.history.limit);
  const messages: ModelMessage[] = [...previous];
  const allSteps: unknown[] = [];
  const tools = createToolSet(sessionId);
  const isComplete = successToolCall<typeof tools>("complete");
  const isStop = successToolCall<typeof tools>("stop");

  let resultText = "";
  const agent = new ToolLoopAgent({
    model: provider.languageModel("chat-model"),
    instructions: systemPrompt(goal),
    toolChoice: "required",
    providerOptions: {
      openai: {
        parallelToolCalls: true
      },
    },
    tools,
    stopWhen: [stepCountIs(1)],
  });

  for (let iteration = 0; iteration < config.ai.maxSteps; iteration += 1) {
    messages.push(await buildMessage(goal, messages));

    const stepResult = await agent.generate({ messages });
    messages.push(...stepResult.response.messages);
    allSteps.push(...stepResult.steps);
    resultText = stepResult.text;

    if (isComplete({ steps: stepResult.steps })) {
      break;
    }
    if (isStop({ steps: stepResult.steps })) {
      break;
    }
  }

  await saveMessages(sessionId, messages, config.history.limit);
  return { steps: allSteps, text: resultText };
}
