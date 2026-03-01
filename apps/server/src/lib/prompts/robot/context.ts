import type { ConversationContext } from "@boost/db/queries/chat";
import type { StepRequest } from "@boost/validators";

export function contextPrompt(input: StepRequest, context: ConversationContext): string {
  return `\
<context>
Mission goal: ${input.goal}
Scene observation: ${input.observation.scene ?? "(none provided)"}
Depth summary: ${input.observation.depthSummary ?? "(none provided)"}
Frame reference: ${input.observation.frameRef ?? "(none)"}
Rolling mission summary: ${context.rollingSummary}
Recent step history:
${context.recentHistory || "No prior history."}
</context>

If you need more context before deciding, call getHubHealth or getPosition first.
Then call exactly one motion tool.`;
}
