'use client';

import { AnimatePresence, motion } from 'framer-motion';

/**
 * A gradient bar that creeps toward 90% while a request is in flight and
 * snaps to full when it lands — the honest version of a progress bar for
 * work whose duration you can't know.
 */
export function TopProgress({ active }: { active: boolean }) {
  return (
    <AnimatePresence>
      {active && (
        <motion.div
          className="top-progress"
          initial={{ width: '0%', opacity: 1 }}
          animate={{ width: '90%' }}
          exit={{ width: '100%', opacity: 0, transition: { duration: 0.32 } }}
          transition={{ duration: 1.6, ease: 'easeOut' }}
        />
      )}
    </AnimatePresence>
  );
}
