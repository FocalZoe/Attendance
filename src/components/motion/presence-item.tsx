import * as React from 'react';
import { m } from 'motion/react';
import { fadeUp } from '@/lib/motion';

interface PresenceItemProps extends React.HTMLAttributes<HTMLElement> {
  as?: 'li' | 'div';
}

/**
 * A list row that fades in when added and out when removed.
 * Put rows inside <AnimatePresence initial={false}> so removal can play before they unmount;
 * `layout` lets the remaining rows slide up into the gap.
 */
export function PresenceItem({ as = 'li', children, ...props }: PresenceItemProps) {
  const Comp = m[as] as React.ElementType;
  return (
    <Comp layout="position" variants={fadeUp} initial="hidden" animate="visible" exit="exit" {...props}>
      {children}
    </Comp>
  );
}
