export const config = {
  history: {
    limit: 12,
  },
  hub: {
    timeoutMs: 45_000,
    pollIntervalMs: 1_500,
  },
  ai: {
    maxToolSteps: 5,
    chatPrimary: "gemini-2.0-flash",
    chatRetries: ["gemini-2.0-flash-thinking-exp", "gemini-1.5-flash"],
    summariserPrimary: "gemini-2.0-flash",
    summariserRetries: ["gemini-1.5-flash"],
  },
} as const;
