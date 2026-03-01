import type { ConversationContext } from "@boost/db/queries/chat";
import type { StepRequest } from "@boost/validators";
import { contextPrompt } from "./context";
import { corePrompt } from "./core";
import { examplesPrompt } from "./examples";
import { reasoningPrompt } from "./reasoning";
import { safetyPrompt } from "./safety";
import { toolsPrompt } from "./tools";

export function robotPrompt(input: StepRequest, context: ConversationContext): string {
  return [
    corePrompt,
    safetyPrompt,
    toolsPrompt,
    reasoningPrompt,
    examplesPrompt,
    contextPrompt(input, context),
  ]
    .join("\n\n")
    .trim();
}
