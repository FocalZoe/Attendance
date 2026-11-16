import * as React from 'react';
import { m } from 'motion/react';
import { fadeUp } from '@/lib/motion';

/** Wrap a page's content so it fades in from slightly below when the page appears */
export function PageTransition({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <m.div className={className} variants={fadeUp} initial="hidden" animate="visible">
      {children}
    </m.div>
  );
}
