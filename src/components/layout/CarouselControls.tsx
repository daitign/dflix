import { Icon } from '../icons/Icon';
import { IconButton } from '../primitives/IconButton';

interface CarouselControlsProps {
  canGoNext: boolean;
  canGoPrevious: boolean;
  label: string;
  onNext: () => void;
  onPrevious: () => void;
}

export function CarouselControls({
  canGoNext,
  canGoPrevious,
  label,
  onNext,
  onPrevious,
}: CarouselControlsProps) {
  return (
    <div className="carousel-shell__controls">
      <IconButton
        aria-label={`Previous items in ${label}`}
        disabled={!canGoPrevious}
        onClick={onPrevious}
        size="sm"
        tone="glass"
        tooltip="Previous"
      >
        <Icon name="chevronLeft" size={18} />
      </IconButton>
      <IconButton
        aria-label={`Next items in ${label}`}
        disabled={!canGoNext}
        onClick={onNext}
        size="sm"
        tone="glass"
        tooltip="Next"
      >
        <Icon name="chevronRight" size={18} />
      </IconButton>
    </div>
  );
}
