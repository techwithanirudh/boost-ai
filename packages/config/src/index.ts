export const config = {
  history: {
    limit: 35,
  },
  hub: {
    /** Poll interval while waiting for hub to be healthy (ms). */
    pollIntervalMs: 1_500,
  },
};
