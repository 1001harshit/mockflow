'use client';

import { motion, useReducedMotion } from 'framer-motion';

/**
 * Two slowly wandering colour fields behind the whole app. They never move far
 * enough to notice mid-task — the point is that the background isn't a flat
 * void when you glance away and back.
 *
 * Kept deliberately cheap. These are large elements carrying a heavy blur, and
 * a blur is re-rasterised whenever the thing under it changes shape — so they
 * only ever translate. Scaling them, which is what this did first, meant
 * repainting a 90px blur across 600px every frame, forever, on every page.
 */
export function Backdrop() {
  const still = useReducedMotion();

  const drift = (path: { x: number[]; y: number[] }, duration: number) =>
    still
      ? undefined
      : {
          animate: path,
          transition: { duration, repeat: Infinity, ease: 'easeInOut' as const },
        };

  return (
    <div className="backdrop" aria-hidden>
      <motion.div
        className="blob blob-a"
        {...drift({ x: [0, 90, -30, 0], y: [0, 50, 110, 0] }, 28)}
      />
      <motion.div
        className="blob blob-b"
        {...drift({ x: [0, -70, 40, 0], y: [0, 80, 20, 0] }, 34)}
      />
    </div>
  );
}
