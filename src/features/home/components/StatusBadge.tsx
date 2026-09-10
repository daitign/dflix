import { Badge } from '../../../components/primitives/Badge';
import type { MediaBadge } from '../../catalog';

interface StatusBadgeProps {
  status: MediaBadge;
}

const labels: Record<MediaBadge, string> = {
  'recently-added': 'Recently Added',
  'new-episode': 'New Episode',
  'new-season': 'New Season',
  trending: 'Trending',
  'top-10': 'Top 10',
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const tone = status === 'trending' || status === 'top-10' ? 'accent' : 'neutral';
  return <Badge dot={status === 'new-episode'} tone={tone}>{labels[status]}</Badge>;
}
