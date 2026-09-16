'use client';

import { motion, type HTMLMotionProps, type Variants } from 'framer-motion';
import { springSnappy } from '../motion';
import { Spinner } from './Spinner';

type Variant = 'primary' | 'secondary' | 'ghost' | 'chaos' | 'danger';

const shell: Variants = {
  rest: { y: 0, scale: 1 },
  hover: { y: -1, scale: 1.025 },
  tap: { scale: 0.955 },
};

/** The light only sweeps when the parent is in its hover variant. */
const shine: Variants = {
  rest: { x: '-130%' },
  hover: { x: '130%', transition: { duration: 0.75, ease: 'easeInOut' } },
};

export function Button({
  variant = 'secondary',
  size,
  busy = false,
  className = '',
  children,
  disabled,
  ...rest
}: {
  variant?: Variant;
  size?: 'sm';
  busy?: boolean;
  children?: React.ReactNode;
} & Omit<HTMLMotionProps<'button'>, 'ref' | 'children'>) {
  const inert = disabled || busy;
  return (
    <motion.button
      className={`btn btn-${variant} ${size === 'sm' ? 'btn-sm' : ''} ${className}`}
      disabled={inert}
      initial="rest"
      animate="rest"
      whileHover={inert ? undefined : 'hover'}
      whileTap={inert ? undefined : 'tap'}
      variants={shell}
      transition={springSnappy}
      {...rest}
    >
      {variant === 'primary' && !inert && (
        <motion.span className="btn-shine" variants={shine} />
      )}
      {busy && <Spinner />}
      {children}
    </motion.button>
  );
}
