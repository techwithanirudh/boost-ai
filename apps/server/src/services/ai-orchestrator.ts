import { getOrCreateSession, loadMessages, saveMessages } from "@boost/db/queries/chat";
import type { ActionDecision, StepRequest } from "@boost/validators";
import { decisionSchema } from "@boost/validators";
import type { ModelMessage, UserContent } from "ai";
import { Output, generateText, stepCountIs } from "ai";
import { systemPrompt } from "@/lib/prompts/system";
import { createDiagnosticTools } from "@/lib/tools";
import { config, provider } from "@/lib/providers";
import { fetchLatestFrame } from "./frame";

export interface AIResult {
  decision: ActionDecision;
  toolCalls: unknown;
}

export async function decideNextAction(input: StepRequest): Promise<AIResult> {
  const sessionId = input.sessionId ?? input.missionId ?? crypto.randomUUID();

  await getOrCreateSession({
    id: sessionId,
    goal: input.goal,
    missionId: input.missionId,
  });

  if (input.dryRun) {
    return {
      decision: { action: "stop", value: 0, speed: 0.5, text: "dry run — no action taken" },
      toolCalls: [],
    };
  }

  const previousMessages = await loadMessages(sessionId, config.history.limit);

  // Build the user message: frame image + optional depth map + goal text
  const frameData = await fetchLatestFrame();

  const userContent: UserContent = [
    { type: "image", image: frameData },
    ...(input.depthMapUrl
      ? [{ type: "image" as const, image: new URL(input.depthMapUrl) }]
      : []),
    { type: "text", text: `Goal: ${input.goal}` },
  ];

  const messages: ModelMessage[] = [
    ...previousMessages,
    { role: "user", content: userContent },
  ];

  const model = provider.languageModel("chat-model");

  const result = await generateText({
    model,
    system: systemPrompt(input.goal),
    messages,
    tools: createDiagnosticTools(),
    stopWhen: stepCountIs(config.ai.maxToolSteps),
    output: Output.object({ schema: decisionSchema }),
    temperature: 0.1,
  });

  // Persist: previous history + new user message + all assistant/tool messages
  await saveMessages(
    sessionId,
    [...previousMessages, { role: "user", content: userContent }, ...result.response.messages],
    config.history.limit,
  );

  return {
    decision: result.output,
    toolCalls: result.toolCalls,
  };
}
