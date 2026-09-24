'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

/**
 * Renders its children only while near the visible area; elsewhere it keeps an empty box of the
 * same size, so a 480-page planner scrolls smoothly (§8.1: only visible pages mount).
 */
export function LazyVisible({
  widthMm,
  heightMm,
  children,
}: {
  widthMm: number;
  heightMm: number;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element || typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }
    // Start drawing a screen and a half ahead, so pages are ready before they scroll in.
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry?.isIntersecting ?? true),
      {
        rootMargin: '150% 0px',
      },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} style={{ minWidth: `${widthMm}mm`, minHeight: `${heightMm}mm` }}>
      {visible ? children : null}
    </div>
  );
}
