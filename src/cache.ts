/**
 * In-memory message cache with TTL-based garbage collection.
 * Stores incoming DM messages so they can be recovered when deleted.
 */

export interface CachedMessage {
  senderId: number;
  username?: string;
  firstName?: string;
  lastName?: string;
  text?: string;
  caption?: string;
  date: Date;
  mediaType?:
    | "photo"
    | "video"
    | "document"
    | "voice"
    | "audio"
    | "sticker"
    | "gif"
    | "video_note";
  mediaPath?: string;
}

const DEFAULT_TTL_MS = 48 * 60 * 60 * 1000; // 48 hours
const CLEANUP_INTERVAL_MS = 10 * 60 * 1000; // every 10 minutes

export class MessageCache {
  private cache: Map<number, CachedMessage> = new Map();
  private timestamps: Map<number, number> = new Map();
  private ttlMs: number;
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor(ttlMs: number = DEFAULT_TTL_MS) {
    this.ttlMs = ttlMs;
    this.startCleanup();
  }

  /** Store a message in the cache. */
  set(messageId: number, message: CachedMessage): void {
    this.cache.set(messageId, message);
    this.timestamps.set(messageId, Date.now());
  }

  /** Retrieve a cached message by its ID. */
  get(messageId: number): CachedMessage | undefined {
    return this.cache.get(messageId);
  }

  /** Remove a message from the cache. Returns true if it existed. */
  delete(messageId: number): boolean {
    this.timestamps.delete(messageId);
    return this.cache.delete(messageId);
  }

  /** Current number of cached messages. */
  get size(): number {
    return this.cache.size;
  }

  /** Remove all messages older than the TTL. */
  private cleanup(): void {
    const now = Date.now();
    let removed = 0;

    for (const [id, timestamp] of this.timestamps) {
      if (now - timestamp > this.ttlMs) {
        this.cache.delete(id);
        this.timestamps.delete(id);
        removed++;
      }
    }

    if (removed > 0) {
      console.log(
        `🧹 Cache cleanup: removed ${removed} expired messages (${this.cache.size} remaining)`
      );
    }
  }

  /** Start the periodic cleanup interval. */
  private startCleanup(): void {
    if (this.cleanupTimer) return;
    this.cleanupTimer = setInterval(() => this.cleanup(), CLEANUP_INTERVAL_MS);
    // Allow the process to exit even if the timer is running
    if (this.cleanupTimer.unref) {
      this.cleanupTimer.unref();
    }
  }

  /** Stop the cleanup interval (for graceful shutdown). */
  stopCleanup(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }
}
