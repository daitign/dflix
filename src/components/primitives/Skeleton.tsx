import type { CSSProperties, HTMLAttributes } from 'react';
import { cx } from '../../lib/cx';
import './Skeleton.css';

interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  height?: CSSProperties['height'];
  radius?: 'sm' | 'md' | 'lg' | 'pill';
  width?: CSSProperties['width'];
}

export function Skeleton({
  className,
  height,
  radius = 'md',
  style,
  width,
  ...props
}: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={cx('skeleton', `skeleton--${radius}`, className)}
      style={{ height, width, ...style }}
      {...props}
    />
  );
}
