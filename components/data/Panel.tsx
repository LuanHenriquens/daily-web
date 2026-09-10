import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Exported so an ad hoc shell needing its own grid does not hand-copy the recipe. */
export const cardSurface =
  'rounded-xl border bg-card shadow-e2 backdrop-blur-xl backdrop-saturate-150';

interface Props {
  id?: string;
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  compact?: boolean;
  className?: string;
  children: ReactNode;
}

/**
 * The standard content container: one block per topic, never one giant card with
 * the whole screen inside it. The cuts between blocks are what say where one topic
 * ends and the next begins.
 *
 * Padding lives once on the section, never `py` on the root plus `px` per slot.
 * Never nest a Panel around a CardContent — that is how you get double padding.
 */
export function Panel({ id, title, description, action, compact = false, className, children }: Props) {
  return (
    <section
      id={id}
      className={cn(cardSurface, 'flex h-full flex-col', compact ? 'gap-3 p-5' : 'gap-5 p-6', className)}
    >
      {(title || action) && (
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
          <div className="grid min-w-0 gap-1">
            {title && (
              <h3 className={compact ? 'type-caption text-ink-dim' : 'type-subhead'}>{title}</h3>
            )}
            {description && <p className="max-w-prose text-sm text-ink-mid">{description}</p>}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      {children}
    </section>
  );
}
