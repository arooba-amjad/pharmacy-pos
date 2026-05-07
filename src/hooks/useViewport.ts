import { useEffect, useState } from 'react';

export type ViewportSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';

const BREAKPOINTS = {
  xs: 0,
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
} as const;

function getSize(width: number): ViewportSize {
  if (width >= BREAKPOINTS['2xl']) return '2xl';
  if (width >= BREAKPOINTS.xl) return 'xl';
  if (width >= BREAKPOINTS.lg) return 'lg';
  if (width >= BREAKPOINTS.md) return 'md';
  if (width >= BREAKPOINTS.sm) return 'sm';
  return 'xs';
}

function readViewport() {
  if (typeof window === 'undefined') {
    return { width: 1280, height: 720, size: 'xl' as ViewportSize };
  }
  const width = window.innerWidth;
  const height = window.innerHeight;
  return { width, height, size: getSize(width) };
}

/**
 * Live viewport snapshot. Updated on `resize` (rAF-throttled) so layouts
 * can adapt without flooding renders.
 */
export function useViewport() {
  const [vp, setVp] = useState(readViewport);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    let raf = 0;
    const onResize = () => {
      if (raf) return;
      raf = window.requestAnimationFrame(() => {
        raf = 0;
        setVp(readViewport());
      });
    };
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, []);

  return vp;
}

/** True if the viewport is at least the given size. */
export function isAtLeast(size: ViewportSize, target: ViewportSize) {
  return BREAKPOINTS[size] >= BREAKPOINTS[target];
}
