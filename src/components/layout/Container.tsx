import type { HTMLAttributes } from 'react';
import { cx } from '../../lib/cx';

interface ContainerProps extends HTMLAttributes<HTMLDivElement> {
  narrow?: boolean;
}

export function Container({ className, narrow = false, ...props }: ContainerProps) {
  return <div className={cx('container', narrow && 'container--narrow', className)} {...props} />;
}
