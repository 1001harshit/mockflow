'use client';

import { motion } from 'framer-motion';
import { popIn } from '../motion';

export function EmptyState({
  title,
  children,
}: {
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <motion.div className="empty" variants={popIn} initial="hidden" animate="show">
      <strong>{title}</strong>
      {children}
    </motion.div>
  );
}
