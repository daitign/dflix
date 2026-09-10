import type { HTMLAttributes } from 'react';
import { cx } from '../../lib/cx';
import './Badge.css';

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  dot?: boolean;
  tone?: 'neutral' | 'accent' | 'success' | 'outline';
}

export function Badge({ children, className, dot = false, tone = 'neutral', ...props }: BadgeProps) {
  return (
    <span className={cx('badge', `badge--${tone}`, className)} {...props}>
      {dot && <span aria-hidden="true" className="badge__dot" />}
      {children}
    </span>
  );
}
