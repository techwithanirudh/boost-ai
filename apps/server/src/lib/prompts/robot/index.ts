import { contextPrompt } from "./context";
import { corePrompt } from "./core";
import { examplesPrompt } from "./examples";
import { reasoningPrompt } from "./reasoning";
import { safetyPrompt } from "./safety";
import { toolsPrompt } from "./tools";

/**
 * Assemble the full system prompt for one step.
 * The goal is injected into the final <context> section; everything else is static.
 */
export function robotPrompt(goal: string): string {
  return [
    corePrompt,
    safetyPrompt,
    toolsPrompt,
    reasoningPrompt,
    examplesPrompt,
    contextPrompt(goal),
  ]
    .join("\n\n")
    .trim();
}
