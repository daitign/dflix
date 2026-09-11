import type { ReactNode } from 'react';
import { Icon } from '../icons/Icon';
import './SectionHeader.css';

interface SectionHeaderProps {
  action?: ReactNode;
  description?: ReactNode;
  eyebrow?: string;
  title: ReactNode;
}

export function SectionHeader({ action, description, eyebrow, title }: SectionHeaderProps) {
  return (
    <header className="section-header">
      <div className="section-header__copy">
        {eyebrow && <p className="section-header__eyebrow">{eyebrow}</p>}
        <h2 className="section-header__title">
          <span className="section-header__title-text">{title}</span>
          <span aria-hidden="true" className="section-header__explore">
            <span>Explore All</span>
            <Icon name="chevronRight" size={15} />
          </span>
        </h2>
        {description && <div className="section-header__description">{description}</div>}
      </div>
      {action && <div className="section-header__action">{action}</div>}
    </header>
  );
}
