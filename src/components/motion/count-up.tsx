import * as React from 'react';
import { animate, useReducedMotion } from 'motion/react';
import { DURATION, EASE_OUT } from '@/lib/motion';

/** Counts from the previous number to the new one. Shows the final number at once for reduced motion. */
export function CountUp({ value, className }: { value: number; className?: string }) {
  const reduce = useReducedMotion();
  const ref = React.useRef<HTMLSpanElement>(null);
  const previous = React.useRef(0);

  React.useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (reduce) {
      node.textContent = String(value);
      previous.current = value;
      return;
    }
    const controls = animate(previous.current, value, {
      duration: DURATION.slow * 2,
      ease: EASE_OUT,
      onUpdate: (latest) => {
        node.textContent = String(Math.round(latest));
      },
    });
    previous.current = value;
    return () => controls.stop();
  }, [value, reduce]);

  return (
    <span ref={ref} className={className}>
      {value}
    </span>
  );
}
