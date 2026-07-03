import { EventEmitter } from "events";

/**
 * A singleton EventEmitter used to bridge asynchronous WebSocket responses
 * (coming from the Agent via Redis pub/sub) back to pending HTTP request handlers.
 *
 * Usage:
 *   - HTTP handler registers listener: requestRegistry.once(requestId, handler)
 *   - Gateway subscriber emits: requestRegistry.emit(requestId, message)
 */
class RequestRegistry extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(500); // Support many concurrent transfers
  }

  /**
   * Wait for a single message with the given requestId, with a timeout.
   * Returns a promise that resolves with the message or rejects on timeout.
   */
  waitFor<T>(requestId: string, timeoutMs = 30_000): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.off(requestId, handler);
        reject(new Error(`Request timed out: ${requestId}`));
      }, timeoutMs);

      const handler = (data: T) => {
        clearTimeout(timer);
        resolve(data);
      };

      this.once(requestId, handler);
    });
  }
}

export const requestRegistry = new RequestRegistry();
