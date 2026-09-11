import type { HTMLAttributes } from 'react';
import { cx } from '../../lib/cx';
import './SpatialAudioBadge.css';

export interface SpatialAudioBadgeProps extends HTMLAttributes<HTMLSpanElement> {
  size?: 'sm' | 'md';
}

export function SpatialAudioBadge({ className, size = 'md', ...props }: SpatialAudioBadgeProps) {
  return (
    <span
      aria-label="Spatial Audio"
      className={cx('spatial-audio-badge', `spatial-audio-badge--${size}`, className)}
      role="img"
      title="Spatial Audio"
      {...props}
    >
      <svg
        aria-hidden="true"
        className="spatial-audio-badge__icon"
        fill="none"
        viewBox="0 0 32 32"
      >
        {/* Head */}
        <circle cx="16" cy="15.2" fill="currentColor" r="4.3" />
        {/* Torso / Shoulders */}
        <path
          d="M 6.8 25.4 C 6.8 21.2 10.6 19.8 16 19.8 C 21.4 19.8 25.2 21.2 25.2 25.4 C 23.0 28.3 19.8 29.8 16 29.8 C 12.2 29.8 9.0 28.3 6.8 25.4 Z"
          fill="currentColor"
        />
        {/* Top waves */}
        <path d="M 7.8 5 A 14.5 14.5 0 0 1 24.2 5" stroke="currentColor" strokeLinecap="round" strokeWidth="1.85" />
        <path d="M 10.2 8.2 A 10.5 10.5 0 0 1 21.8 8.2" stroke="currentColor" strokeLinecap="round" strokeWidth="1.85" />
        {/* Left waves */}
        <path d="M 4.2 22.8 A 14.5 14.5 0 0 1 4.2 9.2" stroke="currentColor" strokeLinecap="round" strokeWidth="1.85" />
        <path d="M 7.5 20.8 A 10.5 10.5 0 0 1 7.5 11.2" stroke="currentColor" strokeLinecap="round" strokeWidth="1.85" />
        {/* Right waves */}
        <path d="M 27.8 9.2 A 14.5 14.5 0 0 1 27.8 22.8" stroke="currentColor" strokeLinecap="round" strokeWidth="1.85" />
        <path d="M 24.5 11.2 A 10.5 10.5 0 0 1 24.5 20.8" stroke="currentColor" strokeLinecap="round" strokeWidth="1.85" />
      </svg>
      <span className="spatial-audio-badge__text">
        <span className="spatial-audio-badge__primary">Spatial</span>
        <span className="spatial-audio-badge__secondary">Audio</span>
      </span>
    </span>
  );
}
