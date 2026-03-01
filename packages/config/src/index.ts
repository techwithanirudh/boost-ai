export const config = {
  history: {
    /** Number of ModelMessages kept per session (user + assistant pairs = ~10 turns). */
    limit: 35,
  },
  ai: {
    /** Max internal tool-call steps before generateText forces a stop. */
    maxToolSteps: 5,
  },
  hub: {
    /** How long to wait for the hub to become healthy on startup (ms). */
    timeoutMs: 45_000,
    /** Poll interval while waiting for hub (ms). */
    pollIntervalMs: 1_500,
  },
};
