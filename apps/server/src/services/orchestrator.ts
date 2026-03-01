import { loadMessages, saveMessages } from "@boost/db/queries/sessions";
import type { ModelMessage, UserContent } from "ai";
import { ToolLoopAgent, stepCountIs } from "ai";
import { successToolCall } from "@/lib/agents/utils";
import { systemPrompt } from "@/lib/prompts/system";
import { config, provider } from "@/lib/providers";
import { createToolSet } from "@/lib/tools";
import { fetchLatestFrame } from "./frame";

/**
 * Run one autonomous agent loop for a session.
 *
 * Fetches the latest camera frame, appends it alongside the goal as a user
 * message, then runs the ToolLoopAgent until one of:
 *   - `complete` tool is called (goal achieved, session marked done in DB)
 *   - `stop` tool is called (safety halt)
 *   - maxToolSteps limit is reached (caller should invoke again for next turn)
 *
 * All messages (user + assistant + tool results) are persisted to DB so the
 * agent retains full history across calls.
 *
 * TODO: add depth-map image from ml-depth-pro sidecar as second image part.
 */
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
      stepCountIs(config.ai.maxToolSteps),
      successToolCall("complete"),
      successToolCall("stop"),
    ],
    experimental_telemetry: { isEnabled: true, functionId: "robot-orchestrator" },
  }).generate({ messages });

  await saveMessages(
    sessionId,
    [...messages, ...result.response.messages],
    config.history.limit,
  );

  return result;
}
