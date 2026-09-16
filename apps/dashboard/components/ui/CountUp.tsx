'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

/**
 * A number that rolls to its new value instead of snapping to it, so a refresh
 * reads as "these moved" rather than "the page redrew". Null renders as a dash
 * — the stat simply hasn't loaded yet.
 */
export function CountUp({
  value,
  format = (n) => String(Math.round(n)),
  duration = 750,
}: {
  value: number | null | undefined;
  format?: (n: number) => string;
  duration?: number;
}) {
  const [display, setDisplay] = useState(0);
  const [flash, setFlash] = useState(false);
  const current = useRef(0);
  const seeded = useRef(false);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (value == null) return;

    const from = current.current;
    const to = value;

    // Seed before the early return, so a stat that legitimately starts at zero
    // still counts as "seen" and its first real change flashes like any other.
    const first = !seeded.current;
    seeded.current = true;
    if (from === to) return;

    let flashTimer: ReturnType<typeof setTimeout> | undefined;
    if (!first) {
      setFlash(true);
      flashTimer = setTimeout(() => setFlash(false), 800);
    }

    if (reduced || duration <= 0) {
      current.current = to;
      setDisplay(to);
      return () => clearTimeout(flashTimer);
    }

    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
      const next = from + (to - from) * eased;
      current.current = next;
      setDisplay(next);
      if (t < 1) frame = requestAnimationFrame(tick);
      else current.current = to;
    };
    frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(flashTimer);
    };
  }, [value, duration, reduced]);

  if (value == null) return <span className="faint">—</span>;

  return (
    <motion.span
      // the figure lifts and warms for a beat when its number moves
      animate={
        flash
          ? { scale: [1, 1.09, 1], filter: ['brightness(1)', 'brightness(1.5)', 'brightness(1)'] }
          : { scale: 1 }
      }
      transition={{ duration: 0.8, ease: 'easeOut' }}
      style={{ display: 'inline-block', transformOrigin: 'left center' }}
      className={flash ? 'grad-text' : undefined}
    >
      {format(display)}
    </motion.span>
  );
}
