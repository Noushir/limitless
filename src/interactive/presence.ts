export interface PresenceTracker {
  recordInput(now: number): void;
  isIdle(seconds: number, now: number): boolean;
}

export function createPresenceTracker(): PresenceTracker {
  let lastInputAt: number | null = null;
  return {
    recordInput(now) {
      lastInputAt = now;
    },
    isIdle(seconds, now) {
      if (lastInputAt === null) return true;
      return now - lastInputAt >= seconds;
    },
  };
}
