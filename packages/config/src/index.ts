export const config = {
  history: {
    limit: 35,
  },
  hub: {
    /** How long to wait for the hub to become healthy on startup (ms). */
    timeoutMs: 45_000,
    /** Poll interval while waiting for hub to be healthy (ms). */
    pollIntervalMs: 1_500,
  },
};
