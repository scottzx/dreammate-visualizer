import { useEffect, type RefObject } from 'react';
import { useThree } from '@react-three/fiber';
import { scheduleAnimationFrames } from './frame-scheduler';

/** Animated scenes draw at 30 fps; paused scenes draw only when something changes. */
export default function SceneFrameLoop({ animate, element }: { animate: boolean; element: RefObject<HTMLDivElement | null> }) {
  const get = useThree(state => state.get);
  const advance = useThree(state => state.advance);
  const invalidate = useThree(state => state.invalidate);
  const setFrameloop = useThree(state => state.setFrameloop);
  useEffect(() => {
    let stop: (() => void) | undefined;
    const update = () => {
      stop?.(); stop = undefined;
      const elapsed = get().clock.elapsedTime;
      // Discard pending demand frames before switching to the manual clock (seconds).
      // R3F's global RAF uses milliseconds and can otherwise draw one leftover frame.
      if (document.hidden || animate) get().internal.frames = 0;
      setFrameloop(document.hidden || animate ? 'never' : 'demand');
      get().clock.elapsedTime = elapsed;
      if (document.hidden) return;
      if (!animate) { invalidate(); return; }
      let time = elapsed;
      stop = scheduleAnimationFrames(delta => { time += delta; advance(time); }, {
        request: callback => window.requestAnimationFrame(callback),
        cancel: id => window.cancelAnimationFrame(id),
      });
    };
    update();
    document.addEventListener('visibilitychange', update);
    return () => { stop?.(); document.removeEventListener('visibilitychange', update); };
  }, [animate, advance, get, invalidate, setFrameloop]);
  useEffect(() => {
    if (animate) return;
    const scene = element.current;
    let trailing: number | undefined;
    const wake = () => {
      invalidate();
      window.clearTimeout(trailing);
      // Label proximity is stored in refs and still needs a frame while motion is paused.
      trailing = window.setTimeout(invalidate, 250);
    };
    scene?.addEventListener('pointermove', wake);
    scene?.addEventListener('pointerleave', wake);
    return () => {
      window.clearTimeout(trailing);
      scene?.removeEventListener('pointermove', wake);
      scene?.removeEventListener('pointerleave', wake);
    };
  }, [animate, element, invalidate]);
  return null;
}
