import type { StopCondition, ToolSet } from "ai";

/**
 * Stop the agent loop as soon as a specific tool has been called successfully.
 * "Success" is defined as the tool result containing `{ ok: true }`.
 */
export function successToolCall<T extends ToolSet>(toolName: string): StopCondition<T> {
  return ({ steps }) =>
    steps
      .at(-1)
      ?.toolResults?.some(
        (r) => r.toolName === toolName && (r.output as { ok?: boolean })?.ok === true,
      ) ?? false;
}
