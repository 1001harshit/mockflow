'use client';

import { motion } from 'framer-motion';

export function Spinner() {
  return (
    <motion.span
      className="spinner"
      aria-hidden
      animate={{ rotate: 360 }}
      transition={{ repeat: Infinity, duration: 0.7, ease: 'linear' }}
    />
  );
}
