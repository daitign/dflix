import type { ComponentPropsWithoutRef, ElementType } from 'react';
import { cx } from '../../lib/cx';
import './CardShell.css';

type CardShellProps<T extends ElementType = 'article'> = {
  as?: T;
  density?: 'compact' | 'comfortable' | 'none';
  interactive?: boolean;
  tone?: 'base' | 'raised' | 'glass';
} & Omit<ComponentPropsWithoutRef<T>, 'as'>;

export function CardShell<T extends ElementType = 'article'>({
  as,
  className,
  density = 'comfortable',
  interactive = false,
  tone = 'base',
  ...props
}: CardShellProps<T>) {
  const Component = as ?? 'article';

  return (
    <Component
      className={cx(
        'card-shell',
        `card-shell--${tone}`,
        `card-shell--${density}`,
        interactive && 'card-shell--interactive',
        className,
      )}
      {...props}
    />
  );
}
