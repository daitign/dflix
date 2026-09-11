import type { HTMLAttributes } from 'react';

interface RankNumeralProps extends HTMLAttributes<HTMLSpanElement> {
  rank: number;
}

export function RankNumeral({ rank, className = '', ...props }: RankNumeralProps) {
  return (
    <span
      aria-hidden="true"
      className={`rankNumber ranked-card__number ranked-card__number--rank-${rank} ${className}`.trim()}
      {...props}
    >
      {rank}
    </span>
  );
}

