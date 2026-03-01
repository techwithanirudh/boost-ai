export const config = {
  ai: {
    maxSteps: 100,
  },
  history: {
    limit: 35,
  },
  hub: {
    /** Poll interval while waiting for hub to be healthy (ms). */
    pollIntervalMs: 1_500,
  },
};
