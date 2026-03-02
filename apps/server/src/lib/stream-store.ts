/**
 * In-memory store for active robot session streams.
 * Allows the client to reconnect to an ongoing session stream on page refresh.
 */

interface Entry {
  abort: AbortController;
  stream: ReadableStream<Uint8Array>;
}

const store = new Map<string, Entry>();

export function setStream(
  sessionId: string,
  stream: ReadableStream<Uint8Array>,
  abort: AbortController
) {
  store.set(sessionId, { abort, stream });
}

export function getStream(
  sessionId: string
): ReadableStream<Uint8Array> | null {
  return store.get(sessionId)?.stream ?? null;
}

export function abortStream(sessionId: string) {
  const entry = store.get(sessionId);
  if (entry) {
    entry.abort.abort();
    store.delete(sessionId);
  }
}

export function clearStream(sessionId: string) {
  store.delete(sessionId);
}
