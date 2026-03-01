/**
 * Injected as the final section of the system prompt.
 * The actual frame image and optional depth map are passed as image parts
 * in the user message — not here.
 */
export function contextPrompt(goal: string): string {
  return `\
<context>
Mission goal: ${goal}
The current camera frame (and depth map if available) are attached as images in this message.
Analyse them against the goal before deciding.
Call getHubHealth or getPosition first if you need diagnostic information.
Then call exactly one motion tool.
</context>`;
}
