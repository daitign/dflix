import { cx } from '../../lib/cx';
import './BrandMark.css';

interface BrandMarkProps {
  compact?: boolean;
  className?: string;
}

export function BrandMark({ compact = false, className }: BrandMarkProps) {
  return (
    <a aria-label="DAITIGN Stream" className={cx('brand-mark', className)} href="#home">
      <img
        alt=""
        aria-hidden="true"
        className={compact ? 'brand-mark__monogram' : 'brand-mark__wordmark'}
        src={compact ? '/brand/daitign-mark.svg' : '/brand/daitign-wordmark.svg'}
      />
    </a>
  );
}
