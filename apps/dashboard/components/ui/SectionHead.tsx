'use client';

import { motion } from 'framer-motion';
import { listItem } from '../motion';

export function SectionHead({ title, count }: { title: string; count?: string }) {
  return (
    <motion.div className="section-head" variants={listItem}>
      <h3>{title}</h3>
      {count && <span className="count">{count}</span>}
    </motion.div>
  );
}
