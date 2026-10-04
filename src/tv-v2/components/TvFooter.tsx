import { BrandMark } from '../../components/brand/BrandMark';
import { Icon } from '../../components/icons/Icon';
import { useTvFocusNode, useTvFocusRow } from '../focus/useTvFocus.ts';
import './TvComponents.css';

interface TvFooterProps {
  onBackToTop: () => void;
  onOpenExternal?: (url: string) => void;
}

export function TvFooter({ onBackToTop, onOpenExternal }: TvFooterProps) {
  useTvFocusRow({ id: 'footer-row', order: 1000 });

  return (
    <footer className="tv-v2-footer" data-row-id="footer-row">
      <div className="tv-v2-footer__brand">
        <BrandMark compact />
      </div>

      <div className="tv-v2-footer__links">
        <FooterButton
          colIndex={0}
          icon={<Icon name="chevronUp" size={18} />}
          id="footer-back-to-top"
          label="Back to Top"
          onSelect={onBackToTop}
        />

        <FooterButton
          colIndex={1}
          icon={<Icon name="telegram" size={16} />}
          id="footer-telegram"
          label="Telegram"
          onSelect={() => onOpenExternal?.('https://t.me/daitign')}
        />

        <FooterButton
          colIndex={2}
          icon={<Icon name="sparkles" size={16} />}
          id="footer-shop"
          label="Shop"
          onSelect={() => onOpenExternal?.('https://shop.daitign.com')}
        />

        <FooterButton
          colIndex={3}
          icon={<Icon name="info" size={16} />}
          id="footer-contact"
          label="Contact"
          onSelect={() => onOpenExternal?.('mailto:support@daitign.com')}
        />
      </div>

      <div className="tv-v2-footer__copyright">
        <span>© {new Date().getFullYear()} DAITIGN STREAM • Android TV Edition</span>
      </div>
    </footer>
  );
}

function FooterButton({
  colIndex,
  icon,
  id,
  label,
  onSelect,
}: {
  colIndex: number;
  icon?: React.ReactNode;
  id: string;
  label: string;
  onSelect: () => void;
}) {
  const { isFocused } = useTvFocusNode({
    colIndex,
    id,
    onSelect,
    rowId: 'footer-row',
  });

  return (
    <div
      className={`tv-v2-footer-btn ${isFocused ? 'tv-v2-footer-btn--focused' : ''}`}
      id={id}
      onClick={onSelect}
      role="button"
      tabIndex={-1}
    >
      {icon}
      <span>{label}</span>
    </div>
  );
}
