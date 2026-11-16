import * as React from 'react';
import { Tabs as TabsPrimitive } from 'radix-ui';
import { m } from 'motion/react';
import { transitions } from '@/lib/motion';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';

/* Keeps the active value so each trigger knows whether to draw the sliding underline */
const TabsContext = React.createContext<{ value: string | undefined; id: string }>({ value: undefined, id: '' });

const Tabs = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Root>
>(({ value, defaultValue, onValueChange, ...props }, ref) => {
  const id = React.useId();
  const [inner, setInner] = React.useState(defaultValue);
  const current = value ?? inner;
  return (
    <TabsContext.Provider value={{ value: current, id }}>
      <TabsPrimitive.Root
        ref={ref}
        value={current}
        onValueChange={(v) => {
          setInner(v);
          onValueChange?.(v);
        }}
        {...props}
      />
    </TabsContext.Provider>
  );
});
Tabs.displayName = TabsPrimitive.Root.displayName;

/* 底線式分頁：以線表示目前位置，窄螢幕可橫向捲動 */
const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <ScrollArea scrollbars="horizontal" className="w-full border-b border-border">
    <TabsPrimitive.List
      ref={ref}
      className={cn('flex w-max min-w-full items-end gap-1 text-muted-foreground', className)}
      {...props}
    />
  </ScrollArea>
));
TabsList.displayName = TabsPrimitive.List.displayName;

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, children, value, ...props }, ref) => {
  const ctx = React.useContext(TabsContext);
  return (
    <TabsPrimitive.Trigger
      ref={ref}
      value={value}
      className={cn(
        'relative -mb-px inline-flex h-11 shrink-0 items-center justify-center whitespace-nowrap px-4 text-sm font-medium transition-colors hover:text-foreground focus-visible:outline-none focus-visible:bg-secondary disabled:pointer-events-none disabled:opacity-50 data-[state=active]:text-foreground',
        className
      )}
      {...props}
    >
      {children}
      {ctx.value === value && (
        <m.span
          layoutId={`tabs-underline-${ctx.id}`}
          transition={transitions.base}
          className="absolute inset-x-0 bottom-0 h-0.5 bg-primary"
          aria-hidden="true"
        />
      )}
    </TabsPrimitive.Trigger>
  );
});
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn('mt-4 focus-visible:outline-none duration-200 data-[state=active]:animate-in data-[state=active]:fade-in-0 data-[state=active]:slide-in-from-bottom-1', className)}
    {...props}
  />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsList, TabsTrigger, TabsContent };
