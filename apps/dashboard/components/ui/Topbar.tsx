'use client';

import { motion } from 'framer-motion';
import { spring, springSnappy } from '../motion';

export function Topbar({
  href,
  children,
}: {
  href?: string;
  children?: React.ReactNode;
}) {
  const Brand = href ? motion.a : motion.span;
  return (
    <motion.header
      className="topbar"
      initial={{ y: -70, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ ...spring, damping: 26 }}
    >
      <div className="topbar-inner">
        <Brand
          className="brand"
          href={href}
          initial="rest"
          animate="rest"
          whileHover="hover"
        >
          <motion.span
            className="brand-mark"
            variants={{ rest: { rotate: 0, scale: 1 }, hover: { rotate: 90, scale: 1.12 } }}
            transition={springSnappy}
          />
          MockFlow
        </Brand>
        <div className="topbar-actions">{children}</div>
      </div>
    </motion.header>
  );
}
