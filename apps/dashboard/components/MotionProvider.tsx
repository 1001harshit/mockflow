'use client';

import { MotionConfig } from 'framer-motion';

/**
 * `reducedMotion="user"` makes every animation in the app honour the OS
 * setting automatically — transforms and opacity are dropped, layout still
 * settles. One switch instead of a media query in every component.
 */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
