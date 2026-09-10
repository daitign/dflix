import { useState, type CSSProperties, type ImgHTMLAttributes } from 'react';
import { cx } from '../../lib/cx';
import { Icon } from '../icons/Icon';
import './ResponsiveImage.css';

export interface ResponsiveImageSource {
  media?: string;
  srcSet: string;
  type?: string;
}

interface ResponsiveImageProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'srcSet'> {
  aspectRatio?: `${number} / ${number}`;
  fallbackLabel?: string;
  objectPosition?: CSSProperties['objectPosition'];
  sources?: ResponsiveImageSource[];
}

export function ResponsiveImage({
  alt,
  aspectRatio = '16 / 9',
  className,
  fallbackLabel = 'Image unavailable',
  loading = 'lazy',
  objectPosition = 'center',
  onError,
  onLoad,
  sources = [],
  style,
  ...props
}: ResponsiveImageProps) {
  const [hasError, setHasError] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);

  return (
    <span
      className={cx('responsive-image', hasLoaded && 'responsive-image--loaded', className)}
      style={{ aspectRatio, ...style }}
    >
      {!hasError ? (
        <picture>
          {sources.map((source) => (
            <source key={`${source.media}-${source.srcSet}`} {...source} />
          ))}
          <img
            alt={alt}
            loading={loading}
            onError={(event) => {
              setHasError(true);
              onError?.(event);
            }}
            onLoad={(event) => {
              setHasLoaded(true);
              onLoad?.(event);
            }}
            style={{ objectPosition }}
            {...props}
          />
        </picture>
      ) : (
        <span className="responsive-image__fallback" role="img" aria-label={fallbackLabel}>
          <Icon name="sparkles" size={24} />
          <span>{fallbackLabel}</span>
        </span>
      )}
    </span>
  );
}
