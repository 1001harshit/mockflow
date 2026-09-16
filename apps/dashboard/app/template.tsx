'use client';

import { motion } from 'framer-motion';
import { page } from '@/components/motion';

/**
 * App Router remounts a template on every navigation, which makes it the
 * right place for the route transition. Children that declare `variants`
 * and no `animate` of their own inherit "show" from here, so a page's
 * entrance stagger falls out of the tree shape rather than being wired up
 * component by component.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <motion.div variants={page} initial="hidden" animate="show">
      {children}
    </motion.div>
  );
}
