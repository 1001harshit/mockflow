'use client';

import { motion } from 'framer-motion';
import { listItem, springSoft } from '../motion';
import { CountUp } from './CountUp';

export function StatStrip({ children }: { children: React.ReactNode }) {
  return (
    <motion.div className="stat-strip" variants={listItem}>
      {children}
    </motion.div>
  );
}

export function Stat({
  label,
  value,
  format,
  sub,
}: {
  label: string;
  value: number | null | undefined;
  format?: (n: number) => string;
  sub?: React.ReactNode;
}) {
  return (
    <motion.div
      className="stat"
      initial="rest"
      animate="rest"
      whileHover="hover"
      variants={{ rest: { y: 0 }, hover: { y: -2 } }}
      transition={springSoft}
    >
      <motion.span
        className="stat-wash"
        variants={{ rest: { opacity: 0 }, hover: { opacity: 1 } }}
        transition={springSoft}
        aria-hidden
      />
      <div className="label">{label}</div>
      <div className="value">
        <CountUp value={value} format={format} />
      </div>
      <div className="sub">{sub}</div>
    </motion.div>
  );
}
