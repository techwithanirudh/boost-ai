import { corePrompt } from "./core";
import { reasoningPrompt } from "./reasoning";
import { toolsPrompt } from "./tools";

export function systemPrompt(): string {
  return [
    corePrompt,
    toolsPrompt,
    reasoningPrompt,
  ]
    .join("\n\n")
    .trim();
}
