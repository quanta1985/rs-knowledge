// Chapter 2 figure helpers: an animation clock that runs only while the figure is on screen, and number formatting.
import { useEffect, useRef, useState, type RefObject } from 'react';
import type { Lang } from '../i18n/ui';

/** Seconds of animation time; pauses when `playing` is false or the element is off-screen. Starts paused under reduced motion. */
export function useAnimClock(el: RefObject<Element | null>) {
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(true);
  const visible = useRef(false);
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) setPlaying(false);
    const io = new IntersectionObserver(([e]) => { visible.current = e.isIntersecting; });
    if (el.current) io.observe(el.current);
    return () => io.disconnect();
  }, [el]);
  useEffect(() => {
    if (!playing) return;
    let raf = 0, last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      if (visible.current) setT((x) => x + dt);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing]);
  return { t, playing, setPlaying };
}

export const fmt = (lang: Lang) => {
  const loc = lang === 'vi' ? 'vi-VN' : 'en-US';
  return (v: number, d = 0) => v.toLocaleString(loc, { minimumFractionDigits: d, maximumFractionDigits: d });
};

/** Round SVG coordinates to 0.1 px so server and browser maths agree (hydration). */
export const r1 = (v: number) => Math.round(v * 10) / 10;

export const PLAY = { vi: ['Tạm dừng', 'Chạy'], en: ['Pause', 'Play'] } as const;
