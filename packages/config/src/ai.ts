export const config = {
  history: {
    limit: 12,
  },
  hub: {
    timeoutMs: 45_000,
    pollIntervalMs: 1_500,
  }
} as const;
