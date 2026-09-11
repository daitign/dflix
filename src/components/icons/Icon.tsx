import type { ReactNode, SVGProps } from 'react';

export type IconName =
  | 'bell'
  | 'bookmark'
  | 'check'
  | 'chevronDown'
  | 'chevronLeft'
  | 'chevronRight'
  | 'close'
  | 'grid'
  | 'fullscreen'
  | 'heart'
  | 'home'
  | 'info'
  | 'menu'
  | 'play'
  | 'plus'
  | 'search'
  | 'sparkles'
  | 'thumbUp'
  | 'user'
  | 'volume'
  | 'volumeOff';

interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'children'> {
  name: IconName;
  size?: number;
}

const paths: Record<IconName, ReactNode> = {
  bell: <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />,
  bookmark: <path d="M6 4.8A1.8 1.8 0 0 1 7.8 3h8.4A1.8 1.8 0 0 1 18 4.8V21l-6-3.6L6 21z" />,
  check: <path d="m5 12 4.25 4.25L19 6.5" />,
  chevronDown: <path d="m6 9 6 6 6-6" />,
  chevronLeft: <path d="m15 18-6-6 6-6" />,
  chevronRight: <path d="m9 18 6-6-6-6" />,
  close: <path d="M18 6 6 18M6 6l12 12" />,
  grid: <path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z" />,
  fullscreen: <path d="M8 3H3v5M16 3h5v5M21 16v5h-5M8 21H3v-5" />,
  heart: <path d="M20.8 4.7a5.5 5.5 0 0 0-7.8 0L12 5.8l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.4 1.1-1.1a5.5 5.5 0 0 0-.1-7.8z" />,
  home: <path d="m3 11 9-8 9 8v9a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z" />,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7.5v.1" /></>,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  play: <path d="m8 5 11 7-11 7z" />,
  plus: <path d="M12 5v14M5 12h14" />,
  search: <path d="m21 21-4.6-4.6m2.1-5.15a7.25 7.25 0 1 1-14.5 0 7.25 7.25 0 0 1 14.5 0" />,
  sparkles: <path d="m12 3 1.1 3.15L16 7.5l-2.9 1.35L12 12l-1.1-3.15L8 7.5l2.9-1.35zM6.5 13l1.35 3.15L11 17.5l-3.15 1.35L6.5 22l-1.35-3.15L2 17.5l3.15-1.35zM18 13l.85 2.15L21 16l-2.15.85L18 19l-.85-2.15L15 16l2.15-.85z" />,
  thumbUp: <path d="M7 10v11M15 5.75 14 10h5.75a2 2 0 0 1 1.92 2.56l-2.25 7A2 2 0 0 1 17.5 21H5a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h1.75a2 2 0 0 0 1.79-1.11L12 2a3.15 3.15 0 0 1 3 3.75Z" />,
  user: <path d="M19 21a7 7 0 0 0-14 0M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8" />,
  volume: <><path d="M11 5 6.5 9H3v6h3.5L11 19z" /><path d="M15 9a4 4 0 0 1 0 6M18 6a8 8 0 0 1 0 12" /></>,
  volumeOff: <><path d="M11 5 6.5 9H3v6h3.5L11 19zM16 10l5 5M21 10l-5 5" /></>,
};

export function Icon({ name, size = 20, ...props }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height={size}
      viewBox="0 0 24 24"
      width={size}
      {...props}
    >
      <g
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      >
        {paths[name]}
      </g>
    </svg>
  );
}
