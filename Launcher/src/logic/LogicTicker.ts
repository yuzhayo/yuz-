// Lightweight RAF ticker (not wired yet). Processors can reuse later.

export type RafTicker = {
  add(fn: (dt: number) => void): void;
  remove(fn: (dt: number) => void): void;
  start(): void;
  stop(): void;
  dispose(): void;
};

export function createRafTicker(): RafTicker {
  const subs = new Set<(dt: number) => void>();
  let running = false;
  let rafId = 0;
  let last = 0;

  const loop = (t: number) => {
    rafId = requestAnimationFrame(loop);
    const dt = last ? (t - last) / 1000 : 0;
    last = t;
    for (const fn of subs) fn(dt || 0);
  };

  return {
    add(fn) {
      subs.add(fn);
    },
    remove(fn) {
      subs.delete(fn);
    },
    start() {
      if (running) return;
      running = true;
      last = 0;
      rafId = requestAnimationFrame(loop);
    },
    stop() {
      if (!running) return;
      running = false;
      cancelAnimationFrame(rafId);
      rafId = 0;
    },
    dispose() {
      this.stop();
      subs.clear();
    },
  };
}
