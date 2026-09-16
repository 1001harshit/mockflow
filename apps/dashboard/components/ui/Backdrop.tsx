'use client';

import { motion } from 'framer-motion';

/**
 * Two slowly wandering colour fields behind the whole app. They never move
 * far enough to notice mid-task — the point is that the background isn't
 * a flat void when you glance away and back.
 */
export function Backdrop() {
  return (
    <div className="backdrop" aria-hidden>
      <motion.div
        className="blob blob-a"
        animate={{ x: [0, 90, -30, 0], y: [0, 50, 110, 0], scale: [1, 1.15, 0.94, 1] }}
        transition={{ duration: 28, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="blob blob-b"
        animate={{ x: [0, -70, 40, 0], y: [0, 80, 20, 0], scale: [1, 0.92, 1.12, 1] }}
        transition={{ duration: 34, repeat: Infinity, ease: 'easeInOut' }}
      />
    </div>
  );
}
