import type { ReactNode, SVGProps } from 'react';

export type IconName =
  | 'bell'
  | 'bookmark'
  | 'caretDown'
  | 'caretUp'
  | 'check'
  | 'chevronDown'
  | 'chevronLeft'
  | 'chevronRight'
  | 'chevronUp'
  | 'close'
  | 'grid'
  | 'fullscreen'
  | 'heart'
  | 'home'
  | 'info'
  | 'menu'
  | 'pause'
  | 'play'
  | 'plus'
  | 'rotateCcw'
  | 'rotateCw'
  | 'search'
  | 'server'
  | 'settings'
  | 'skipBack'
  | 'skipForward'
  | 'sparkles'
  | 'subtitles'
  | 'telegram'
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
  caretDown: <path d="m6 9.5 6 6 6-6z" fill="currentColor" stroke="none" />,
  caretUp: <path d="m6 14.5 6-6 6 6z" fill="currentColor" stroke="none" />,
  check: <path d="m5 12 4.25 4.25L19 6.5" />,
  chevronDown: <path d="m6 9 6 6 6-6" />,
  chevronLeft: <path d="m15 18-6-6 6-6" />,
  chevronRight: <path d="m9 18 6-6-6-6" />,
  chevronUp: <path d="m6 15 6-6 6 6" />,
  close: <path d="M18 6 6 18M6 6l12 12" />,
  grid: <path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z" />,
  fullscreen: <path d="M8 3H3v5M16 3h5v5M21 16v5h-5M8 21H3v-5" />,
  heart: <path d="M20.8 4.7a5.5 5.5 0 0 0-7.8 0L12 5.8l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.4 1.1-1.1a5.5 5.5 0 0 0-.1-7.8z" />,
  home: <path d="m3 11 9-8 9 8v9a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z" />,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7.5v.1" /></>,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  pause: <path d="M6 4h4v16H6zM14 4h4v16h-4z" fill="currentColor" stroke="none" />,
  play: <path d="m8 5 11 7-11 7z" fill="currentColor" stroke="none" />,
  plus: <path d="M12 5v14M5 12h14" />,
  rotateCcw: <><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /></>,
  rotateCw: <><path d="M21 12a9 9 0 1 1-9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" /><path d="M21 3v5h-5" /></>,
  search: <path d="m21 21-4.6-4.6m2.1-5.15a7.25 7.25 0 1 1-14.5 0 7.25 7.25 0 0 1 14.5 0" />,
  server: <><rect x="2" y="2" width="20" height="8" rx="2" /><rect x="2" y="14" width="20" height="8" rx="2" /><line x1="6" y1="6" x2="6.01" y2="6" /><line x1="6" y1="18" x2="6.01" y2="18" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" /></>,
  skipBack: <><polygon points="19 20 9 12 19 4 19 20" /><line x1="5" y1="19" x2="5" y2="5" /></>,
  skipForward: <><polygon points="5 4 15 12 5 20 5 4" /><line x1="19" y1="5" x2="19" y2="19" /></>,
  sparkles: <path d="m12 3 1.1 3.15L16 7.5l-2.9 1.35L12 12l-1.1-3.15L8 7.5l2.9-1.35zM6.5 13l1.35 3.15L11 17.5l-3.15 1.35L6.5 22l-1.35-3.15L2 17.5l3.15-1.35zM18 13l.85 2.15L21 16l-2.15.85L18 19l-.85-2.15L15 16l2.15-.85z" />,
  subtitles: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M7 15h4M15 15h2M7 11h2M13 11h4" /></>,
  telegram: (
    <path
      d="M21.4 3.4a1 1 0 0 0-1.1-.2L3 10.3c-1.3.5-1.3 1.3-.2 1.7l4.7 1.5 10.9-6.9c.5-.3 1-.1.6.3L10.2 15l-.3 4.8c.5 0 .8-.2 1.1-.5l2.6-2.5 5.2 3.8c1 .6 1.7.3 1.9-.9l3.4-15.8c.4-1.6-.6-2.3-1.7-1.5z"
      fill="currentColor"
      stroke="none"
    />
  ),
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
