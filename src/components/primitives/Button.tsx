import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react';
import { cx } from '../../lib/cx';
import './Button.css';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'quiet';
type ButtonSize = 'sm' | 'md' | 'lg';

interface SharedButtonProps {
  children: ReactNode;
  className?: string;
  endIcon?: ReactNode;
  fullWidth?: boolean;
  isLoading?: boolean;
  size?: ButtonSize;
  startIcon?: ReactNode;
  variant?: ButtonVariant;
}

type NativeButtonProps = SharedButtonProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, keyof SharedButtonProps> & {
    href?: never;
  };

type LinkButtonProps = SharedButtonProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, keyof SharedButtonProps> & {
    href: string;
  };

export type ButtonProps = NativeButtonProps | LinkButtonProps;

export function Button({
  children,
  className,
  endIcon,
  fullWidth = false,
  isLoading = false,
  size = 'md',
  startIcon,
  variant = 'primary',
  ...props
}: ButtonProps) {
  const classes = cx(
    'button',
    `button--${variant}`,
    `button--${size}`,
    fullWidth && 'button--full',
    isLoading && 'button--loading',
    className,
  );

  const content = (
    <>
      {isLoading ? <span aria-hidden="true" className="button__spinner" /> : startIcon}
      <span>{children}</span>
      {endIcon}
    </>
  );

  if ('href' in props && props.href) {
    const linkProps = props as Omit<AnchorHTMLAttributes<HTMLAnchorElement>, keyof SharedButtonProps> & {
      href: string;
    };
    return (
      <a aria-disabled={isLoading || undefined} className={classes} {...linkProps}>
        {content}
      </a>
    );
  }

  const buttonProps = props as Omit<
    ButtonHTMLAttributes<HTMLButtonElement>,
    keyof SharedButtonProps
  >;
  return (
    <button
      {...buttonProps}
      className={classes}
      disabled={isLoading || buttonProps.disabled}
      type={buttonProps.type ?? 'button'}
    >
      {content}
    </button>
  );
}
