'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { message, springSnappy } from '../motion';

/**
 * Messages squash their own height on the way in and out, so nothing below
 * them jumps. A repeated message re-keys and nudges, which is the only way to
 * tell "it failed again" from "the message never left".
 */
export function Alert({
  kind = 'error',
  children,
}: {
  kind?: 'error' | 'ok';
  children: React.ReactNode;
}) {
  return (
    <AnimatePresence initial={false} mode="wait">
      {children ? (
        <motion.div
          key={String(children)}
          className={`alert ${kind}`}
          variants={message}
          initial="hidden"
          animate="show"
          exit="exit"
        >
          <motion.div
            initial={{ x: 0 }}
            animate={kind === 'error' ? { x: [0, -5, 4, -2, 0] } : { x: 0 }}
            transition={{ ...springSnappy, delay: 0.1 }}
          >
            {children}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
