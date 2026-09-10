import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cx } from '../../lib/cx';
import './IconButton.css';

interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  'aria-label': string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  tone?: 'default' | 'glass' | 'accent';
  tooltip?: string;
}

export function IconButton({
  'aria-label': ariaLabel,
  children,
  className,
  size = 'md',
  tone = 'default',
  tooltip,
  type = 'button',
  ...props
}: IconButtonProps) {
  return (
    <span className="icon-button-wrap" data-tooltip={tooltip}>
      <button
        aria-label={ariaLabel}
        className={cx('icon-button', `icon-button--${size}`, `icon-button--${tone}`, className)}
        title={tooltip}
        type={type}
        {...props}
      >
        {children}
      </button>
    </span>
  );
}
