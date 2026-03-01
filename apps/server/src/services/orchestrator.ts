import { loadMessages, saveMessages } from "@boost/db/queries/sessions";
import type { ModelMessage, UserContent } from "ai";
import { stepCountIs, ToolLoopAgent } from "ai";
import { hub } from "@/lib/hub";
import { robotPrompt as systemPrompt } from "@/lib/prompts/robot";
import { config, provider } from "@/lib/providers";
import { createToolSet } from "@/lib/tools";
import { fetchFrame } from "./frame";

interface RunSessionResult {
  steps: unknown[];
  text: string;
}

async function buildMessage(goal: string): Promise<ModelMessage> {
  const sensor = await getSensorContext();
  try {
    const frame = await fetchFrame();
    const userContent: UserContent = [
      { type: "image", image: frame },
      { type: "text", text: `Goal: ${goal}\n${sensor}` },
    ];
    return { role: "user", content: userContent };
  } catch (error) {
    const frameError = error instanceof Error ? error.message : String(error);
    const textContent = `Goal: ${goal}\n${sensor}\nCamera frame unavailable (${frameError}). Continue with caution using sensor context.`;
    return { role: "user", content: [{ type: "text", text: textContent }] };
  }
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

function hasSuccessfulToolCall(
  steps: Array<{ toolResults?: Array<{ output?: unknown; toolName: string }> }>,
  toolName: string
): boolean {
  return (
    steps
      .at(-1)
      ?.toolResults?.some(
        (result) =>
          result.toolName === toolName &&
          (result.output as { ok?: boolean })?.ok === true
      ) ?? false
  );
}

export async function runSession(
  sessionId: string,
  goal: string
): Promise<RunSessionResult> {
  const previous = await loadMessages(sessionId, config.history.limit);
  const messages: ModelMessage[] = [...previous];
  const allSteps: unknown[] = [];

  let resultText = "";
  const agent = new ToolLoopAgent({
    model: provider.languageModel("chat-model"),
    instructions: systemPrompt(goal),
    toolChoice: "required",
    tools: createToolSet(sessionId),
    stopWhen: [stepCountIs(1)],
  });

  for (let iteration = 0; iteration < config.ai.maxSteps; iteration += 1) {
    messages.push(await buildMessage(goal));

    const stepResult = await agent.generate({ messages });
    messages.push(...stepResult.response.messages);
    allSteps.push(...stepResult.steps);
    resultText = stepResult.text;

    if (hasSuccessfulToolCall(stepResult.steps, "complete")) {
      break;
    }
    if (hasSuccessfulToolCall(stepResult.steps, "stop")) {
      break;
    }
  }

  await saveMessages(sessionId, messages, config.history.limit);
  return { steps: allSteps, text: resultText };
}
