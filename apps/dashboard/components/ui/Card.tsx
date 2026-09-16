'use client';

import { motion, type HTMLMotionProps } from 'framer-motion';
import { listItem } from '../motion';

/** A plain surface. It animates in with its list, but doesn't react to hover —
 *  a card you can't click shouldn't pretend otherwise. */
export function Card({
  edge = false,
  flush = false,
  className = '',
  children,
  ...rest
}: {
  edge?: boolean;
  flush?: boolean;
  children?: React.ReactNode;
} & Omit<HTMLMotionProps<'div'>, 'ref' | 'children'>) {
  return (
    <motion.div
      className={`card ${edge ? 'edge' : ''} ${flush ? 'pad-0' : ''} ${className}`}
      variants={listItem}
      {...rest}
    >
      {children}
    </motion.div>
  );
}
