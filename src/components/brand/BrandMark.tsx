import { cx } from '../../lib/cx';
import './BrandMark.css';

interface BrandMarkProps {
  compact?: boolean;
  className?: string;
}

export function BrandMark({ compact = false, className }: BrandMarkProps) {
  return (
    <a aria-label="DAITIGN Stream" className={cx('brand-mark', className)} href="#home">
      <span aria-hidden="true" className="brand-mark__symbol">
        <span className="brand-mark__bar brand-mark__bar--one" />
        <span className="brand-mark__bar brand-mark__bar--two" />
        <span className="brand-mark__bar brand-mark__bar--three" />
      </span>
      {!compact && (
        <span className="brand-mark__wordmark">
          DAITIGN <span>STREAM</span>
        </span>
      )}
    </a>
  );
}
