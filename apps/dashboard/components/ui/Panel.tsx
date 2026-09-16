'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { collapse, listItem, springSnappy } from '../motion';

/**
 * A disclosure that animates its own height and lets `layout` carry the
 * content below it, so opening Import doesn't teleport the endpoints table.
 */
export function Panel({
  title,
  hint,
  defaultOpen = false,
  children,
}: {
  title: string;
  hint?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <motion.div className="panel" variants={listItem} layout>
      <motion.button
        type="button"
        className="panel-summary"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        whileHover={{ backgroundColor: 'rgba(255,255,255,0.03)' }}
        whileTap={{ scale: 0.995 }}
        transition={springSnappy}
      >
        <motion.span
          className="chev"
          animate={{ rotate: open ? 90 : 0 }}
          transition={springSnappy}
          aria-hidden
        >
          ▶
        </motion.span>
        {title}
        {hint && <span className="hint">{hint}</span>}
      </motion.button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            variants={collapse}
            initial="hidden"
            animate="show"
            exit="exit"
            style={{ overflow: 'hidden' }}
          >
            <div className="panel-body">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
