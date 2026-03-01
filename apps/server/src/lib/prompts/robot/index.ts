import { corePrompt } from "./core";
import { examplesPrompt } from "./examples";
import { reasoningPrompt } from "./reasoning";
import { safetyPrompt } from "./safety";
import { toolsPrompt } from "./tools";

export function robotPrompt(goal: string): string {
  return [
    corePrompt,
    safetyPrompt,
    toolsPrompt,
    reasoningPrompt,
    examplesPrompt,
    `<mission-goal>${goal}</mission-goal>`,
  ]
    .join("\n\n")
    .trim();
}
