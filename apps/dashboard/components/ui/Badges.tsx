'use client';

import { motion } from 'framer-motion';
import { springSnappy } from '../motion';

export function MethodBadge({
  method,
  layoutId,
  dimmed = false,
}: {
  method: string;
  /** Share an id with another badge to morph between the two positions. */
  layoutId?: string;
  /** Hide this copy while another element leads the shared transition. */
  dimmed?: boolean;
}) {
  return (
    <motion.span
      className={`method ${method}`}
      layoutId={layoutId}
      animate={{ opacity: dimmed ? 0 : 1 }}
      whileHover={{ scale: 1.07 }}
      transition={springSnappy}
    >
      {method}
    </motion.span>
  );
}

/** Colour marks the exception: a 2xx is the norm, so it stays plain. */
export function StatusCode({ code }: { code: number | string | null | undefined }) {
  if (code == null) return <span className="faint">—</span>;
  const n = typeof code === 'number' ? code : Number(code);
  const tone = n === 0 ? ' warn' : n >= 400 ? ' err' : '';
  return <span className={`status${tone}`}>{n === 0 ? 'dropped' : code}</span>;
}

export function Pill({
  tone,
  children,
}: {
  tone?: 'on' | 'ok' | 'grad';
  children: React.ReactNode;
}) {
  return <span className={`pill ${tone ?? ''}`}>{children}</span>;
}
