import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { cx } from '../../lib/cx';
import { BrandMark } from '../brand/BrandMark';
import { Icon, type IconName } from '../icons/Icon';
import { Badge } from '../primitives/Badge';
import { IconButton } from '../primitives/IconButton';
import { ModalShell } from '../primitives/ModalShell';
import './NavigationShell.css';

interface NavigationShellProps {
  children: ReactNode;
}

interface NavigationItem {
  href: string;
  icon: IconName;
  label: string;
}

const navigationItems: NavigationItem[] = [
  { href: '#home', icon: 'home', label: 'Home' },
  { href: '#movies', icon: 'grid', label: 'Movies' },
  { href: '#series', icon: 'sparkles', label: 'TV Shows' },
  { href: '#my-list', icon: 'bookmark', label: 'My List' },
];

export function NavigationShell({ children }: NavigationShellProps) {
  const [activeSection, setActiveSection] = useState('home');
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const closeMenu = useCallback(() => setIsMenuOpen(false), []);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const sections = navigationItems
      .map((item) => document.querySelector(item.href))
      .filter((section): section is Element => section !== null);

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => Math.abs(a.boundingClientRect.top) - Math.abs(b.boundingClientRect.top));
        if (visible[0]?.target.id) setActiveSection(visible[0].target.id);
      },
      { rootMargin: '-18% 0px -68%', threshold: 0 },
    );

    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, []);

  return (
    <div className="navigation-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>

      <header className={cx('top-navigation', isScrolled && 'top-navigation--scrolled')}>
        <div className="container top-navigation__inner">
          <div className="top-navigation__start">
            <span className="top-navigation__tablet-menu">
              <IconButton
                aria-label="Open navigation"
                onClick={() => setIsMenuOpen(true)}
                tooltip="Menu"
              >
                <Icon name="menu" />
              </IconButton>
            </span>
            <BrandMark />
          </div>

          <nav aria-label="Primary" className="top-navigation__links">
            {navigationItems.map((item) => (
              <a
                aria-current={activeSection === item.href.slice(1) ? 'page' : undefined}
                className="top-navigation__link"
                href={item.href}
                key={item.label}
              >
                {item.label}
              </a>
            ))}
          </nav>

          <div className="top-navigation__actions">
            <IconButton aria-label="Search" tooltip="Search">
              <Icon name="search" />
            </IconButton>
            <span className="top-navigation__desktop-action">
              <IconButton aria-label="Notifications" tooltip="Notifications">
                <Icon name="bell" />
                <span aria-hidden="true" className="top-navigation__notification-dot" />
              </IconButton>
            </span>
            <button aria-label="Open profile" className="profile-button" type="button">
              <span aria-hidden="true">D</span>
            </button>
          </div>
        </div>
      </header>

      {children}

      <nav aria-label="Mobile navigation" className="mobile-navigation">
        <a aria-current={activeSection === 'home' ? 'page' : undefined} className="mobile-navigation__item" href="#home">
          <Icon name="home" size={19} />
          <span>Home</span>
        </a>
        <button aria-label="Search" className="mobile-navigation__item" type="button">
          <Icon name="search" size={19} />
          <span>Search</span>
        </button>
        <a aria-current={activeSection === 'my-list' ? 'page' : undefined} className="mobile-navigation__item" href="#my-list">
          <Icon name="bookmark" size={19} />
          <span>My List</span>
        </a>
        <button aria-label="Open profile" className="mobile-navigation__item" type="button">
          <Icon name="user" size={19} />
          <span>Profile</span>
        </button>
      </nav>

      <ModalShell
        description="Browse DAITIGN Stream"
        isOpen={isMenuOpen}
        onClose={closeMenu}
        placement="left"
        size="sm"
        title={<BrandMark />}
      >
        <nav aria-label="Menu" className="drawer-navigation">
          <Badge dot tone="accent">
            Home / Browse
          </Badge>
          <div className="drawer-navigation__links">
            {navigationItems.map((item) => (
              <a
                aria-current={activeSection === item.href.slice(1) ? 'page' : undefined}
                className="drawer-navigation__link"
                href={item.href}
                key={item.label}
                onClick={closeMenu}
              >
                <Icon name={item.icon} />
                <span>{item.label}</span>
                <Icon className="drawer-navigation__chevron" name="chevronRight" size={17} />
              </a>
            ))}
          </div>
        </nav>
      </ModalShell>
    </div>
  );
}
