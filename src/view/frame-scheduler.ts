export const ANIMATION_FPS = 30;

interface FrameScheduler {
  request: (callback: (timestamp: number) => void) => number;
  cancel: (id: number) => void;
}

/** Cap both useFrame callbacks and GPU draws, independent of monitor refresh rate. */
export function scheduleAnimationFrames(render: (deltaSeconds: number) => void, scheduler: FrameScheduler): () => void {
  const interval = 1000 / ANIMATION_FPS;
  let previous: number | undefined;
  let rendered: number | undefined;
  let pending = 0;
  let stopped = false;
  const tick = (timestamp: number) => {
    if (stopped) return;
    if (previous === undefined || timestamp - previous >= interval - 0.01) {
      const delta = rendered === undefined ? 0 : Math.min(0.1, Math.max(0, (timestamp - rendered) / 1000));
      previous = previous === undefined ? timestamp : previous + Math.floor((timestamp - previous + 0.01) / interval) * interval;
      rendered = timestamp;
      render(delta);
    }
    if (!stopped) pending = scheduler.request(tick);
  };
  pending = scheduler.request(tick);
  return () => { stopped = true; scheduler.cancel(pending); };
}
