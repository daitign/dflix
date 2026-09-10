import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cx } from '../../lib/cx';
import { Icon } from '../icons/Icon';
import { IconButton } from './IconButton';
import './ModalShell.css';

interface ModalShellProps {
  bodyClassName?: string;
  children: ReactNode;
  className?: string;
  description?: ReactNode;
  footer?: ReactNode;
  isOpen: boolean;
  onAfterClose?: () => void;
  onClose: () => void;
  placement?: 'center' | 'left' | 'right' | 'bottom';
  restoreFocusElement?: HTMLElement | null;
  showHeader?: boolean;
  size?: 'sm' | 'md' | 'lg';
  title: ReactNode;
  variant?: 'default' | 'cinematic';
}

const CLOSE_DURATION_MS = 180;

const focusableSelector = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export function ModalShell({
  bodyClassName,
  children,
  className,
  description,
  footer,
  isOpen,
  onAfterClose,
  onClose,
  placement = 'center',
  restoreFocusElement,
  showHeader = true,
  size = 'md',
  title,
  variant = 'default',
}: ModalShellProps) {
  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const [shouldRender, setShouldRender] = useState(isOpen);
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      setIsClosing(false);
      return;
    }

    if (!shouldRender) return;
    setIsClosing(true);
    const timer = window.setTimeout(() => {
      setShouldRender(false);
      setIsClosing(false);
      onAfterClose?.();
    }, CLOSE_DURATION_MS);

    return () => window.clearTimeout(timer);
  }, [isOpen, onAfterClose, shouldRender]);

  useEffect(() => {
    if (!shouldRender) return;

    const previouslyFocused = restoreFocusElement ?? document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    const appRoot = document.getElementById('root');
    const rootWasInert = appRoot?.hasAttribute('inert') ?? false;
    document.body.style.overflow = 'hidden';
    appRoot?.setAttribute('inert', '');

    const frame = requestAnimationFrame(() => {
      const focusable = panelRef.current?.querySelector<HTMLElement>(focusableSelector);
      (focusable ?? panelRef.current)?.focus();
    });

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== 'Tab' || !panelRef.current) return;

      const focusable = Array.from(panelRef.current.querySelectorAll<HTMLElement>(focusableSelector));
      if (focusable.length === 0) {
        event.preventDefault();
        panelRef.current.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      if (!rootWasInert) appRoot?.removeAttribute('inert');
      previouslyFocused?.focus();
    };
  }, [onClose, restoreFocusElement, shouldRender]);

  if (!shouldRender) return null;

  return createPortal(
    <div
      className={cx(
        'modal-shell',
        `modal-shell--${placement}`,
        `modal-shell--${variant}`,
        isClosing && 'modal-shell--closing',
      )}
      onMouseDown={(event) => {
        if (!isClosing && event.target === event.currentTarget) onClose();
      }}
    >
      <div
        aria-describedby={description ? descriptionId : undefined}
        aria-labelledby={titleId}
        aria-modal="true"
        className={cx(
          'modal-shell__panel',
          `modal-shell__panel--${size}`,
          `modal-shell__panel--${variant}`,
          className,
        )}
        ref={panelRef}
        role="dialog"
        tabIndex={-1}
      >
        {showHeader ? (
          <header className="modal-shell__header">
            <div>
              <h2 className="modal-shell__title" id={titleId}>
                {title}
              </h2>
              {description && (
                <div className="modal-shell__description" id={descriptionId}>
                  {description}
                </div>
              )}
            </div>
            <IconButton aria-label="Close dialog" onClick={onClose} tooltip="Close">
              <Icon name="close" />
            </IconButton>
          </header>
        ) : (
          <>
            <h2 className="modal-shell__sr-title" id={titleId}>{title}</h2>
            {description && <div className="modal-shell__sr-title" id={descriptionId}>{description}</div>}
          </>
        )}
        <div className={cx('modal-shell__body', bodyClassName)}>{children}</div>
        {footer && <footer className="modal-shell__footer">{footer}</footer>}
      </div>
    </div>,
    document.body,
  );
}
