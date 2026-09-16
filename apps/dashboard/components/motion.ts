/**
 * The shared motion vocabulary. Every animated surface pulls its timing from
 * here so the whole dashboard moves with one personality instead of a dozen
 * hand-tuned durations.
 */
import type { Transition, Variants } from 'framer-motion';

/** Default: quick, lightly overshooting — for anything the user just did. */
export const spring: Transition = {
  type: 'spring',
  stiffness: 420,
  damping: 32,
  mass: 0.7,
};

/** For size and layout changes, where overshoot would look like a glitch. */
export const springSoft: Transition = {
  type: 'spring',
  stiffness: 240,
  damping: 30,
};

/** For direct manipulation — hover and press need to feel instant. */
export const springSnappy: Transition = {
  type: 'spring',
  stiffness: 620,
  damping: 30,
};

export const easeOut: Transition = { duration: 0.32, ease: [0.16, 1, 0.3, 1] };

/* ---------- lists ---------- */

export const listContainer: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.04 },
  },
};

export const listItem: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: spring },
  exit: { opacity: 0, y: -10, transition: { duration: 0.18 } },
};

/** Table rows sweep in from the leading edge and leave toward it. */
export const rowContainer: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.028, delayChildren: 0.05 } },
};

/** `custom={index}` drives the stagger, because AnimatePresence can't inherit
 *  a container's staggerChildren for rows that arrive one batch at a time. */
export const rowItem: Variants = {
  hidden: { opacity: 0, x: -14 },
  show: (i = 0) => ({
    opacity: 1,
    x: 0,
    transition: { ...spring, delay: Math.min(i, 24) * 0.028 },
  }),
  exit: { opacity: 0, x: 18, transition: { duration: 0.16 } },
};

/* ---------- panels ---------- */

/** Height-to-auto only animates cleanly when opacity trails it slightly. */
export const collapse: Variants = {
  hidden: { height: 0, opacity: 0 },
  show: {
    height: 'auto',
    opacity: 1,
    transition: { height: springSoft, opacity: { duration: 0.2, delay: 0.06 } },
  },
  exit: {
    height: 0,
    opacity: 0,
    transition: { height: { duration: 0.24 }, opacity: { duration: 0.12 } },
  },
};

export const popIn: Variants = {
  hidden: { opacity: 0, scale: 0.96, y: 8 },
  show: { opacity: 1, scale: 1, y: 0, transition: spring },
  exit: { opacity: 0, scale: 0.97, y: -6, transition: { duration: 0.16 } },
};

/** Messages drop in and squash away, so the layout never jumps. */
export const message: Variants = {
  hidden: { opacity: 0, height: 0, y: -8, marginTop: 0, marginBottom: 0 },
  show: {
    opacity: 1,
    height: 'auto',
    y: 0,
    marginTop: '0.75rem',
    marginBottom: '0.75rem',
    transition: springSoft,
  },
  exit: {
    opacity: 0,
    height: 0,
    y: -6,
    marginTop: 0,
    marginBottom: 0,
    transition: { duration: 0.2 },
  },
};

/* ---------- route transitions ---------- */

export const page: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { ...easeOut, staggerChildren: 0.05 } },
};
