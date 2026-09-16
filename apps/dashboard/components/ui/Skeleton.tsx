'use client';

import { motion } from 'framer-motion';

export function Skeleton({ width = '100%' }: { width?: string }) {
  return (
    <motion.div
      className="skeleton"
      style={{ width }}
      animate={{ backgroundPosition: ['100% 50%', '0% 50%'] }}
      transition={{ repeat: Infinity, duration: 1.3, ease: 'linear' }}
    />
  );
}
