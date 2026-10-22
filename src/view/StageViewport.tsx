import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight, MoveHorizontal } from 'lucide-react';

/** A fixed 16:9 observation surface. Portrait changes the viewport, never the world scale. */
export default function StageViewport({ children, scope }: { children: ReactNode; scope: string }) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [offset, setOffset] = useState(0);
  const drag = useRef<{ x: number; scroll: number } | null>(null);
  const stageWidth = size.height * 16 / 9;
  const travel = Math.max(0, stageWidth - size.width);
  useEffect(() => {
    const element = viewportRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setSize({ width: entry.contentRect.width, height: entry.contentRect.height }));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const element = viewportRef.current;
    if (!element) return;
    element.scrollLeft = Math.max(0, (stageWidth - size.width) / 2);
    setOffset(element.scrollLeft);
  }, [stageWidth, size.width, scope]);
  const pan = (direction: number) => viewportRef.current?.scrollBy({ left: direction * size.width * .65, behavior: 'smooth' });
  return <>
    <div className="stage-viewport" ref={viewportRef} data-testid="stage-viewport" data-horizontal-pan={travel > 1} onScroll={event => setOffset(event.currentTarget.scrollLeft)}>
      <div className="stage-track" style={{ minWidth: Math.max(stageWidth, size.width) }}>
        <div className="universe-stage" data-testid="universe-stage" data-aspect-ratio="16:9" style={{ width: stageWidth || '100%', height: size.height || '100%' }}>{children}</div>
      </div>
    </div>
    {travel > 1 && <div className="stage-pan" aria-label="横向移动宇宙沙盘">
      <button aria-label="向左查看沙盘" onClick={() => pan(-1)} disabled={offset < 2}><ChevronLeft size={18} /></button>
      <div className="pan-drag" role="slider" tabIndex={0} aria-label="沙盘横向位置" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(offset / travel * 100)} onKeyDown={event => { if (event.key === 'ArrowLeft') pan(-1); if (event.key === 'ArrowRight') pan(1); }} onPointerDown={event => { drag.current = { x: event.clientX, scroll: viewportRef.current?.scrollLeft ?? 0 }; event.currentTarget.setPointerCapture(event.pointerId); }} onPointerMove={event => { if (drag.current && viewportRef.current) viewportRef.current.scrollLeft = drag.current.scroll + (event.clientX - drag.current.x) * travel / 160; }} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}>
        <MoveHorizontal size={14} /><span>移动视窗 · 比例保持 16:9</span><div className="pan-track"><i style={{ left: `${offset / travel * 76}%` }} /></div>
      </div>
      <button aria-label="向右查看沙盘" onClick={() => pan(1)} disabled={offset >= travel - 2}><ChevronRight size={18} /></button>
    </div>}
  </>;
}
