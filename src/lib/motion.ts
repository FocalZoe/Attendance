import type { Transition, Variants } from 'motion/react';

/** Shared motion tokens. Keep in sync with --ease-out / --dur-* in globals.css */
export const EASE_OUT = [0.22, 1, 0.36, 1] as const;
export const EASE_IN_OUT = [0.65, 0, 0.35, 1] as const;

export const DURATION = { fast: 0.12, base: 0.2, slow: 0.3 } as const;

export const transitions = {
  fast: { duration: DURATION.fast, ease: EASE_OUT },
  base: { duration: DURATION.base, ease: EASE_OUT },
  slow: { duration: DURATION.slow, ease: EASE_OUT },
  /** Springs only for small state pops (status marks, badges) */
  pop: { type: 'spring', stiffness: 520, damping: 30, mass: 0.8 },
} satisfies Record<string, Transition>;

/** Enter from slightly below; used for pages, cards and list rows */
export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: transitions.base },
  exit: { opacity: 0, y: -4, transition: transitions.fast },
};

export const fade: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: transitions.base },
  exit: { opacity: 0, transition: transitions.fast },
};

export const pop: Variants = {
  hidden: { opacity: 0, scale: 0.85 },
  visible: { opacity: 1, scale: 1, transition: transitions.pop },
  exit: { opacity: 0, scale: 0.9, transition: transitions.fast },
};

/** Parent variant that staggers its children's `visible` */
export const stagger = (gap = 0.04, delay = 0): Variants => ({
  hidden: {},
  visible: { transition: { staggerChildren: gap, delayChildren: delay } },
});
