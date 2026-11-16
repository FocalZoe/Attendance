import * as React from 'react';
import { AnimatePresence, m } from 'motion/react';
import { transitions } from '@/lib/motion';

interface CollapseProps {
  open: boolean;
  children: React.ReactNode;
  className?: string;
}

/** Smoothly expands and collapses its content (height + fade). Content unmounts when closed. */
export function Collapse({ open, children, className }: CollapseProps) {
  return (
    <AnimatePresence initial={false}>
      {open && (
        <m.div
          className={className}
          style={{ overflow: 'hidden' }}
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1, transition: transitions.base }}
          exit={{ height: 0, opacity: 0, transition: transitions.fast }}
        >
          {children}
        </m.div>
      )}
    </AnimatePresence>
  );
}
