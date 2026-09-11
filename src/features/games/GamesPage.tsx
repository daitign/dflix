import { useState } from 'react';
import { Button } from '../../components/primitives/Button';
import { Icon } from '../../components/icons/Icon';
import { navigateTo } from '../../lib/navigation/routes';
import './GamesPage.css';

const upcomingGames = [
  {
    id: 'stranger-things',
    title: 'Stranger Things: 1984',
    description: 'Join Hopper and the kids for action-packed missions around Hawkins and the Upside Down in this stylized retro adventure.',
    tag: 'Adventure / Retro',
  },
  {
    id: 'queens-gambit',
    title: "The Queen's Gambit Chess",
    description: 'Welcome to Beth Harmon’s world. Take lessons, play puzzles, or compete against friends in this stunning chess love letter.',
    tag: 'Strategy / Board',
  },
  {
    id: 'oxenfree',
    title: 'OXENFREE',
    description: 'A supernatural thriller about a group of friends who unwittingly open a ghostly rift. Shape your story through radio frequencies.',
    tag: 'Narrative Thriller',
  },
  {
    id: 'shatter',
    title: 'Shatter Remastered',
    description: 'A retro-inspired brick-breaking game that combines classic action with unique twists and incredible boss battles.',
    tag: 'Arcade / Action',
  },
];

export function GamesPage() {
  const [notified, setNotified] = useState(false);

  return (
    <main className="games-page" id="main-content">
      <div className="games-page__hero">
        <div className="games-page__badge">
          <Icon name="sparkles" size={14} />
          <span>Coming Soon</span>
        </div>
        <h1>Mobile Games on DAITIGN Stream</h1>
        <p>
          Immersive storytelling and interactive experiences are coming soon to your favorite devices.
          No ads, no extra fees, and no in-app purchases.
        </p>
        <div className="games-page__actions">
          <Button
            onClick={() => setNotified(true)}
            size="lg"
            startIcon={<Icon name={notified ? 'check' : 'bell'} size={18} />}
            variant={notified ? 'secondary' : 'primary'}
          >
            {notified ? 'We Will Notify You' : 'Notify Me When Available'}
          </Button>
          <Button
            onClick={() => navigateTo('/')}
            size="lg"
            startIcon={<Icon name="play" size={18} />}
            variant="secondary"
          >
            Browse Movies & Shows
          </Button>
        </div>
      </div>

      <div className="games-page__grid">
        {upcomingGames.map((game) => (
          <div className="games-card" key={game.id}>
            <div className="games-card__icon">
              <Icon name="sparkles" size={22} />
            </div>
            <h3>{game.title}</h3>
            <p>{game.description}</p>
            <span className="games-card__tag">{game.tag}</span>
          </div>
        ))}
      </div>
    </main>
  );
}
