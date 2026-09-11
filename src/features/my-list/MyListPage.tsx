import { Container } from '../../components/layout/Container';
import { Button } from '../../components/primitives/Button';
import { Icon } from '../../components/icons/Icon';
import { MediaCard } from '../home/components/MediaCard';
import { navigateTo } from '../../lib/navigation/routes';
import { useMyList, myListItemToMediaItem, type MyListItem } from './MyListProvider';
import './MyListPage.css';

export function MyListPage() {
  const { items } = useMyList();

  if (items.length === 0) {
    return (
      <main className="my-list-page" id="main-content">
        <Container>
          <div className="my-list-empty">
            <div className="my-list-empty__icon">
              <Icon name="bookmark" size={32} />
            </div>
            <h2>Your list is empty</h2>
            <p>Add movies and shows to find them here.</p>
            <Button onClick={() => navigateTo('/')} size="lg" startIcon={<Icon name="play" size={18} />}>
              Explore Titles
            </Button>
          </div>
        </Container>
      </main>
    );
  }

  // Categorize
  const movies = items.filter((i) => i.catalogCategory === 'movie' || (!i.catalogCategory && i.playbackType === 'movie'));
  const anime = items.filter((i) => i.catalogCategory === 'anime');
  const shows = items.filter((i) => i.catalogCategory === 'tv' || (!i.catalogCategory && i.playbackType === 'tv'));

  const groups: Array<{ id: string; title: string; items: MyListItem[] }> = [
    { id: 'movies', title: 'Movies', items: movies },
    { id: 'shows', title: 'Shows', items: shows },
    { id: 'anime', title: 'Anime', items: anime },
  ].filter((g) => g.items.length > 0);

  return (
    <main className="my-list-page" id="main-content">
      <Container>
        <header className="my-list-page__header">
          <h1>My List</h1>
        </header>

        {groups.map((group) => (
          <section className="my-list-page__section" key={group.id}>
            <h2 className="my-list-page__section-title">{group.title}</h2>
            <div className="my-list-page__grid">
              {group.items.map((item) => (
                <MediaCard item={myListItemToMediaItem(item)} key={item.tmdbId} />
              ))}
            </div>
          </section>
        ))}
      </Container>
    </main>
  );
}
