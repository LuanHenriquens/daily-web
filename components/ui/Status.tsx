import type { ReactNode } from 'react';

export type StatusTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

/**
 * The glyph alphabet. State is never hue alone: desaturate a screenshot and
 * every status still has to read, which the shape is what guarantees.
 *
 * Literal Unicode text rather than icon components on purpose — an icon
 * changes the pill's baseline alignment and its gap rhythm.
 */
export const GLYPH = {
  /** active, sent, delivered */
  live: '●',
  /** inactive, pending, not started, ended */
  idle: '○',
  /** in flight, running */
  moving: '◐',
  /** error, overdue, blocked */
  alert: '▲',
} as const;

interface Props {
  tone: StatusTone;
  glyph: string;
  label: ReactNode;
  /** A secondary qualifier, rendered outside the pill so it cannot compete
   *  with the label that actually carries the state. */
  note?: ReactNode;
  className?: string;
}

export function StatusPill({ tone, glyph, label, note, className }: Props) {
  return (
    <span className="status-wrap">
      <span className={`status-pill status-${tone}${className ? ` ${className}` : ''}`}>
        <span className="status-pill-glyph" aria-hidden="true">
          {glyph}
        </span>
        {label}
      </span>
      {note && <span className="status-note">{note}</span>}
    </span>
  );
}

/**
 * The same vocabulary where a pill would be too heavy for a dense list. The
 * dot is decorative; the translated word beside it carries the meaning.
 */
export function StatusDot({ tone }: { tone: StatusTone }) {
  return <span className={`status-dot status-${tone}`} aria-hidden="true" />;
}
