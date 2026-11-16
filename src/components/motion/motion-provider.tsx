import * as React from 'react';
import { LazyMotion, MotionConfig } from 'motion/react';

// domMax (needed for shared-layout animations like the tab underline) is fetched as a separate chunk
const loadFeatures = () => import('@/lib/motion-features').then((mod) => mod.default);

/**
 * App-wide motion setup. LazyMotion keeps the bundle small (use `m.*` elements only),
 * and reducedMotion="user" turns movement off for people who ask their system for less motion.
 */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return (
    <LazyMotion features={loadFeatures} strict>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </LazyMotion>
  );
}
