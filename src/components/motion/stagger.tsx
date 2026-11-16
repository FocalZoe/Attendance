import * as React from 'react';
import { m } from 'motion/react';
import { fadeUp, stagger } from '@/lib/motion';

interface StaggerProps extends Omit<React.HTMLAttributes<HTMLElement>, 'onSubmit'> {
  /** Only used when rendered as a form */
  onSubmit?: React.FormEventHandler<HTMLFormElement>;
  /** Seconds between each child's entrance */
  gap?: number;
  /** Animate when scrolled into view instead of on mount */
  inView?: boolean;
  /** Rendered element; use "ul" for lists so the markup stays semantic */
  as?: 'div' | 'ul' | 'ol' | 'section' | 'form';
}

/** Container whose StaggerItem children enter one after another */
export function Stagger({ gap = 0.04, as = 'div', inView = false, children, ...props }: StaggerProps) {
  const Comp = m[as] as React.ElementType;
  const trigger = inView
    ? { whileInView: 'visible', viewport: { once: true, amount: 0.2 } }
    : { animate: 'visible' };
  return (
    <Comp variants={stagger(gap)} initial="hidden" {...trigger} {...props}>
      {children}
    </Comp>
  );
}

interface StaggerItemProps extends React.HTMLAttributes<HTMLElement> {
  as?: 'div' | 'li' | 'section' | 'tr' | 'fieldset' | 'p';
}

/** Child of Stagger. Also animates out when removed inside an AnimatePresence */
export function StaggerItem({ as = 'div', children, ...props }: StaggerItemProps) {
  const Comp = m[as] as React.ElementType;
  return (
    <Comp variants={fadeUp} {...props}>
      {children}
    </Comp>
  );
}
