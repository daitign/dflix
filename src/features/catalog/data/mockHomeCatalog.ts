import type { HomeCatalog, HomeCatalogGateway, MediaItem, MediaRowModel } from '../types';
import { mockMediaItems } from './mockMedia';

const mediaById = new Map(mockMediaItems.map((item) => [String(item.id), item]));

function select(ids: string[], badgesFor?: string[]): MediaItem[] {
  return ids
    .map((id) => mediaById.get(id))
    .filter((item): item is MediaItem => item !== undefined)
    .map((item) => badgesFor === undefined || badgesFor.includes(String(item.id))
      ? item
      : { ...item, badge: undefined });
}

const rows: MediaRowModel[] = [
  { id: 'trending', title: 'Trending Now', emphasis: 'featured', items: select(['night-crossing', 'dust-protocol', 'violet-engine', 'white-signal', 'after-rain', 'orbit-fall', 'still-house', 'wrong-exit'], ['night-crossing', 'violet-engine', 'white-signal']) },
  { id: 'continue', title: 'Continue Watching', emphasis: 'featured', items: select(['white-signal', 'after-rain', 'celestial-archive', 'hours-between', 'silent-harbor']) },
  { id: 'recently-added', title: 'Recently Added', items: select(['north-of-silence', 'black-cedar', 'orbit-fall', 'glass-season', 'night-crossing', 'summit-line', 'borrowed-sunday'], ['north-of-silence', 'black-cedar', 'glass-season']) },
  { id: 'new-releases', title: 'New Releases', items: select(['last-meridian', 'dust-protocol', 'white-signal', 'glass-season', 'black-cedar', 'celestial-archive', 'night-crossing'], ['last-meridian', 'glass-season']) },
  { id: 'movies', title: 'Popular Movies', items: select(['night-crossing', 'dust-protocol', 'still-house', 'velvet-tide', 'redline-west', 'far-side', 'summit-line', 'paper-moons'], ['night-crossing']) },
  { id: 'series', title: 'Popular TV Shows', items: select(['white-signal', 'after-rain', 'north-of-silence', 'seventh-floor', 'black-cedar', 'glass-season', 'long-shadow', 'silent-harbor'], ['white-signal', 'after-rain']) },
  { id: 'action', title: 'Action', emphasis: 'compact', items: select(['dust-protocol', 'redline-west', 'night-crossing', 'summit-line', 'orbit-fall', 'wrong-exit', 'velvet-tide'], ['dust-protocol']) },
  { id: 'comedy', title: 'Comedy', emphasis: 'compact', items: select(['seventh-floor', 'wrong-exit', 'borrowed-sunday', 'hours-between', 'after-rain', 'paper-moons'], []) },
  { id: 'horror', title: 'Horror', emphasis: 'compact', items: select(['still-house', 'black-cedar', 'ashen-room', 'north-of-silence', 'glass-season', 'long-shadow'], ['black-cedar']) },
  { id: 'sci-fi', title: 'Sci-Fi & Fantasy', emphasis: 'compact', items: select(['last-meridian', 'celestial-archive', 'orbit-fall', 'violet-engine', 'far-side', 'long-shadow', 'white-signal'], ['violet-engine', 'long-shadow']) },
  { id: 'korean', title: 'Korean Series', emphasis: 'compact', items: select(['after-rain', 'glass-season', 'seventh-floor', 'borrowed-sunday', 'hours-between', 'silent-harbor'], ['after-rain']) },
  { id: 'anime', title: 'Anime', emphasis: 'compact', items: select(['celestial-archive', 'violet-engine', 'paper-moons', 'far-side', 'orbit-fall', 'summit-line'], ['celestial-archive']) },
  { id: 'acclaimed', title: 'Critically Acclaimed', emphasis: 'compact', items: select(['last-meridian', 'after-rain', 'night-crossing', 'still-house', 'white-signal', 'paper-moons', 'velvet-tide'], []) },
];

const homeCatalog: HomeCatalog = {
  hero: mediaById.get('last-meridian')!,
  topTen: select(['last-meridian', 'night-crossing', 'after-rain', 'white-signal', 'dust-protocol', 'celestial-archive', 'still-house', 'north-of-silence', 'paper-moons', 'glass-season']),
  rows,
};

export const mockHomeCatalogGateway: HomeCatalogGateway = {
  async getHomeCatalog() {
    return homeCatalog;
  },
};

export function getMockHomeCatalog(): HomeCatalog {
  return homeCatalog;
}
