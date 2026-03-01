import { corePrompt } from "./core";
import { examplesPrompt } from "./examples";
import { reasoningPrompt } from "./reasoning";
import { toolsPrompt } from "./tools";

export function robotPrompt(goal: string): string {
  return [
    corePrompt,
    toolsPrompt,
    reasoningPrompt,
    examplesPrompt,
    `<mission-goal>${goal}</mission-goal>`,
  ]
    .join("\n\n")
    .trim();
}
