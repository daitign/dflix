import { useEffect, useRef, useState } from 'react';
import './CategoryHeader.css';

export interface GenreOption {
  id: string;
  name: string;
  tmdbGenreId?: number;
  languageCode?: string;
}

export interface CategoryHeaderProps {
  genres: GenreOption[];
  onSelectGenre: (genre: GenreOption) => void;
  selectedGenreId: string;
  title: string;
}

export function CategoryHeader({
  genres,
  onSelectGenre,
  selectedGenreId,
  title,
}: CategoryHeaderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  const selectedGenre = genres.find((g) => g.id === selectedGenreId);
  const buttonLabel = selectedGenre && selectedGenre.id !== 'all' ? selectedGenre.name : 'Genres';

  // Handle scroll to add translucent background when passing hero top
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Handle clicks outside the dropdown popover
  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleSelect = (genre: GenreOption) => {
    onSelectGenre(genre);
    setIsOpen(false);
  };

  return (
    <div
      aria-label={`${title} Category Navigation`}
      className={`category-header ${isScrolled ? 'category-header--scrolled' : ''}`}
      role="region"
    >
      <div className="category-header__inner">
        <h1 className="category-header__title">{title}</h1>

        <div
          className={`category-header__picker ${isOpen ? 'category-header__picker--open' : ''}`}
          ref={pickerRef}
        >
          <button
            aria-expanded={isOpen}
            aria-haspopup="true"
            aria-label={`Select genre for ${title}. Current selection: ${buttonLabel}`}
            className="category-header__button"
            onClick={() => setIsOpen((prev) => !prev)}
            type="button"
          >
            <span className="category-header__button-text">{buttonLabel}</span>
            <span aria-hidden="true" className="category-header__caret" />
          </button>

          {isOpen && (
            <div
              aria-label={`${title} Genres`}
              className="category-header__popover"
              role="menu"
            >
              <div className="category-header__grid">
                {genres.map((genre) => {
                  const isSelected = genre.id === selectedGenreId;
                  return (
                    <button
                      className={`category-header__option ${
                        isSelected ? 'category-header__option--selected' : ''
                      }`}
                      key={genre.id}
                      onClick={() => handleSelect(genre)}
                      role="menuitem"
                      type="button"
                    >
                      {genre.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
