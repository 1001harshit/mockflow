'use client';

import { motion } from 'framer-motion';
import { spring, springSnappy } from '../motion';

/**
 * A switch whose knob springs across the track. `busy` holds it mid-flight so
 * the state can't be flipped twice while the write is still in the air.
 */
export function Toggle({
  on,
  onChange,
  busy = false,
  label,
}: {
  on: boolean;
  onChange: (next: boolean) => void;
  busy?: boolean;
  label?: string;
}) {
  return (
    <motion.button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      className={`toggle ${on ? 'on' : ''}`}
      disabled={busy}
      onClick={() => onChange(!on)}
      whileHover={busy ? undefined : { scale: 1.05 }}
      whileTap={busy ? undefined : { scale: 0.95 }}
      transition={springSnappy}
    >
      <motion.span
        className="toggle-knob"
        layout
        transition={spring}
        animate={busy ? { opacity: 0.5, scale: 0.8 } : { opacity: 1, scale: 1 }}
      />
    </motion.button>
  );
}
