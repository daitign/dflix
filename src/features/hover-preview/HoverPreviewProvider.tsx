import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { navigateToWatch } from '../../lib/navigation/watchRoutes';
import { usePreviewAudio } from '../preview-audio';
import { HoverPreviewCard } from './HoverPreviewCard';
import {
  HOVER_PREVIEW_ACTION_EVENT,
  type HoverPreviewAction,
  type HoverPreviewActionDetail,
  type HoverPreviewPlacement,
  type MediaPreviewData,
} from './types';
import { isTVMode } from '../../lib/tv';
import './HoverPreview.css';

const HOVER_OPEN_DELAY_MS = 520;
const POINTER_CLOSE_DELAY_MS = 160;
const COLLAPSE_DURATION_MS = 170;
const MIN_KEYBOARD_PREVIEW_WIDTH = 768;
const MIN_POINTER_PREVIEW_WIDTH = 1024;

interface PreviewPosition {
  left: number;
  placement: HoverPreviewPlacement;
  top: number;
  width: number;
}

interface PreviewRequest {
  anchorElement: HTMLElement;
  data: MediaPreviewData;
  referenceElement: HTMLElement;
  source: 'keyboard' | 'pointer';
}

interface ActivePreview extends PreviewRequest, PreviewPosition {
  openedAt: number;
  phase: 'open' | 'closing';
}

interface HoverPreviewContextValue {
  cancelClose: () => void;
  close: (options?: { immediate?: boolean; returnFocus?: boolean }) => void;
  focusControls: () => boolean;
  isPreviewTarget: (target: EventTarget | null) => boolean;
  performAction: (action: HoverPreviewAction, data: MediaPreviewData, trigger?: HTMLElement | null) => void;
  requestOpen: (request: PreviewRequest) => void;
  scheduleClose: (anchorElement?: HTMLElement) => void;
  supportsPointerPreview: () => boolean;
}

const HoverPreviewContext = createContext<HoverPreviewContextValue | null>(null);

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}

function getPreviewPosition(anchorElement: HTMLElement, referenceElement: HTMLElement): PreviewPosition {
  const anchor = anchorElement.getBoundingClientRect();
  const reference = referenceElement.getBoundingClientRect();
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const safeInset = 16;
  const anchorCenter = anchor.left + anchor.width / 2;
  const placement: HoverPreviewPlacement = anchorCenter < viewportWidth * 0.3
    ? 'left'
    : anchorCenter > viewportWidth * 0.7
      ? 'right'
      : 'center';

  if (isTVMode()) {
    // TV mode: Modest 16:9 cinematic preview tile (~125%–130% of card width, 400–490px at 1080p)
    const baseCardWidth = anchor.width || reference.width || (viewportWidth / 6);
    const targetScale = 1.28;
    const rawWidth = Math.round(baseCardWidth * targetScale);
    const minTvWidth = Math.round(viewportWidth * 0.21); // ~403px at 1080p
    const maxTvWidth = Math.round(viewportWidth * 0.255); // ~490px at 1080p
    const tvWidth = clamp(rawWidth, Math.min(380, minTvWidth), Math.max(460, maxTvWidth));
    const tvHeight = Math.round(tvWidth * (9 / 16));
    const proposedLeft = placement === 'left'
      ? anchor.left
      : placement === 'right'
        ? anchor.right - tvWidth
        : anchorCenter - tvWidth / 2;
    const left = clamp(proposedLeft, safeInset, viewportWidth - tvWidth - safeInset);
    const growthAboveAnchor = (tvHeight - anchor.height) * 0.5;
    const proposedTop = anchor.top - growthAboveAnchor;
    const top = clamp(proposedTop, safeInset, Math.max(safeInset, viewportHeight - tvHeight - safeInset));

    return { left, placement, top, width: tvWidth };
  }

  const maximumWidth = Math.min(512, viewportWidth - safeInset * 2);
  const width = clamp(reference.width * 1.55, 288, maximumWidth);
  const proposedLeft = placement === 'left'
    ? anchor.left
    : placement === 'right'
      ? anchor.right - width
      : anchorCenter - width / 2;
  const left = clamp(proposedLeft, safeInset, viewportWidth - width - safeInset);
  const estimatedHeight = width * 0.5625 + 148;
  const growthAboveAnchor = (estimatedHeight - anchor.height) * 0.62;
  const proposedTop = anchor.top - growthAboveAnchor;
  const top = clamp(proposedTop, safeInset, Math.max(safeInset, viewportHeight - estimatedHeight - safeInset));

  return { left, placement, top, width };
}

function canUsePointerPreview() {
  return window.innerWidth >= MIN_POINTER_PREVIEW_WIDTH
    && window.matchMedia('(hover: hover) and (pointer: fine)').matches;
}

interface HoverPreviewProviderProps {
  children: ReactNode;
}

export function HoverPreviewProvider({ children }: HoverPreviewProviderProps) {
  const { isModalActive } = usePreviewAudio();
  const [activePreview, setActivePreviewState] = useState<ActivePreview | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const activePreviewRef = useRef<ActivePreview | null>(null);
  const openTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeIntentTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const collapseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const announcementTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pointerPreviewSuppressedRef = useRef(false);

  const commitActivePreview = useCallback((preview: ActivePreview | null) => {
    activePreviewRef.current = preview;
    setActivePreviewState(preview);
  }, []);

  const clearTimer = (timerRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>) => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = null;
  };

  const cancelClose = useCallback(() => {
    clearTimer(closeIntentTimerRef);
    clearTimer(collapseTimerRef);

    const current = activePreviewRef.current;
    if (current?.phase === 'closing') commitActivePreview({ ...current, phase: 'open' });
  }, [commitActivePreview]);

  const close = useCallback((options: { immediate?: boolean; returnFocus?: boolean } = {}) => {
    clearTimer(openTimerRef);
    clearTimer(closeIntentTimerRef);
    const current = activePreviewRef.current;
    if (!current) return;

    if (options.returnFocus) current.anchorElement.focus({ preventScroll: true });

    if (options.immediate) {
      clearTimer(collapseTimerRef);
      commitActivePreview(null);
      return;
    }

    if (current.phase === 'closing') return;
    const closingPreview = { ...current, phase: 'closing' as const };
    commitActivePreview(closingPreview);
    collapseTimerRef.current = window.setTimeout(() => {
      if (activePreviewRef.current === closingPreview) commitActivePreview(null);
    }, COLLAPSE_DURATION_MS);
  }, [commitActivePreview]);

  // When Details modal becomes active, immediately destroy hover preview
  useEffect(() => {
    if (isModalActive) {
      close({ immediate: true });
    }
  }, [isModalActive, close]);

  const scheduleClose = useCallback((anchorElement?: HTMLElement) => {
    clearTimer(openTimerRef);
    clearTimer(closeIntentTimerRef);
    closeIntentTimerRef.current = window.setTimeout(() => {
      const current = activePreviewRef.current;
      if (anchorElement && current && current.anchorElement !== anchorElement) return;
      close();
    }, POINTER_CLOSE_DELAY_MS);
  }, [close]);

  const requestOpen = useCallback((request: PreviewRequest) => {
    clearTimer(openTimerRef);
    clearTimer(closeIntentTimerRef);
    clearTimer(collapseTimerRef);

    if (isModalActive) return;
    if (request.source === 'pointer'
      && (pointerPreviewSuppressedRef.current || !canUsePointerPreview())) return;
    if (request.source === 'keyboard' && window.innerWidth < MIN_KEYBOARD_PREVIEW_WIDTH) return;

    const current = activePreviewRef.current;
    if (current && current.anchorElement === request.anchorElement && current.phase === 'open') return;
    if (current) commitActivePreview(null);

    const activate = () => {
      if (!request.anchorElement.isConnected || !request.referenceElement.isConnected) return;
      const position = getPreviewPosition(request.anchorElement, request.referenceElement);
      commitActivePreview({
        ...request,
        ...position,
        openedAt: window.performance.now(),
        phase: 'open',
      });
    };

    if (request.source === 'keyboard') {
      if (isTVMode()) {
        openTimerRef.current = window.setTimeout(activate, 500);
        return;
      }
      activate();
      return;
    }

    openTimerRef.current = window.setTimeout(activate, HOVER_OPEN_DELAY_MS);
  }, [commitActivePreview]);

  const focusControls = useCallback(() => {
    const primaryControl = document.querySelector<HTMLElement>('[data-hover-preview-root] [data-preview-primary]');
    if (!primaryControl || activePreviewRef.current?.phase !== 'open') return false;
    primaryControl.focus({ preventScroll: true });
    return true;
  }, []);

  const isPreviewTarget = useCallback((target: EventTarget | null) => {
    return target instanceof Node
      && Boolean(document.querySelector('[data-hover-preview-root]')?.contains(target));
  }, []);

  const performAction = useCallback((action: HoverPreviewAction, data: MediaPreviewData, trigger?: HTMLElement | null) => {
    const messages: Record<HoverPreviewAction, string> = {
      play: `Playback is unavailable for ${data.title}.`,
      'add-to-list': `${data.title} list preference updated for this preview.`,
      like: `${data.title} rating preference updated for this preview.`,
      details: `${data.title} details opened.`,
    };

    if (action === 'details') close({ immediate: true });
    if (action === 'play') close({ immediate: true });

    window.dispatchEvent(new CustomEvent<HoverPreviewActionDetail>(HOVER_PREVIEW_ACTION_EVENT, {
      detail: { action, media: data, trigger },
    }));
    if (action === 'details') return;
    if (action === 'play' && navigateToWatch(data)) return;
    setAnnouncement(messages[action]);
    clearTimer(announcementTimerRef);
    announcementTimerRef.current = window.setTimeout(() => setAnnouncement(''), 2600);
  }, [close]);

  useEffect(() => {
    const closeForViewportChange = (event: Event) => {
      pointerPreviewSuppressedRef.current = true;
      const current = activePreviewRef.current;
      const isCarouselScroll = event.target instanceof Element
        && Boolean(event.target.closest('.carousel-shell__track'));
      const isInitialKeyboardFocusScroll = current?.source === 'keyboard'
        && document.activeElement === current.anchorElement
        && window.performance.now() - current.openedAt < 180
        && !isCarouselScroll;

      if (current && isInitialKeyboardFocusScroll) {
        const position = getPreviewPosition(current.anchorElement, current.referenceElement);
        commitActivePreview({ ...current, ...position });
        return;
      }

      close({ immediate: true });
    };
    const restorePointerPreview = (event: PointerEvent) => {
      if (event.pointerType === 'mouse' && (event.movementX !== 0 || event.movementY !== 0)) {
        pointerPreviewSuppressedRef.current = false;
      }
    };
    window.addEventListener('scroll', closeForViewportChange, true);
    window.addEventListener('resize', closeForViewportChange);
    window.addEventListener('pointermove', restorePointerPreview, true);
    return () => {
      window.removeEventListener('scroll', closeForViewportChange, true);
      window.removeEventListener('resize', closeForViewportChange);
      window.removeEventListener('pointermove', restorePointerPreview, true);
    };
  }, [close, commitActivePreview]);

  useEffect(() => () => {
    clearTimer(openTimerRef);
    clearTimer(closeIntentTimerRef);
    clearTimer(collapseTimerRef);
    clearTimer(announcementTimerRef);
  }, []);

  const contextValue = useMemo<HoverPreviewContextValue>(() => ({
    cancelClose,
    close,
    focusControls,
    isPreviewTarget,
    performAction,
    requestOpen,
    scheduleClose,
    supportsPointerPreview: canUsePointerPreview,
  }), [cancelClose, close, focusControls, isPreviewTarget, performAction, requestOpen, scheduleClose]);

  return (
    <HoverPreviewContext.Provider value={contextValue}>
      {children}
      {typeof document !== 'undefined' && createPortal(
        <>
          {activePreview && (
            <div className="hover-preview-layer">
              <HoverPreviewCard
                anchorElement={activePreview.anchorElement}
                data={activePreview.data}
                key={`${String(activePreview.data.id)}-${activePreview.left}-${activePreview.top}`}
                onAction={performAction}
                onCancelClose={cancelClose}
                onClose={close}
                onScheduleClose={scheduleClose}
                phase={activePreview.phase}
                placement={activePreview.placement}
                style={{
                  left: activePreview.left,
                  top: activePreview.top,
                  width: activePreview.width,
                }}
              />
            </div>
          )}
          {announcement && <div aria-live="polite" className="hover-preview-toast" role="status">{announcement}</div>}
        </>,
        document.body,
      )}
    </HoverPreviewContext.Provider>
  );
}

interface UseHoverPreviewAnchorOptions {
  data: MediaPreviewData;
}

type PreviewAnchorProps = Pick<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'aria-controls' | 'onBlur' | 'onClick' | 'onFocus' | 'onKeyDown' | 'onPointerCancel' | 'onPointerDown' | 'onPointerEnter' | 'onPointerLeave'
>;

export function useHoverPreviewAnchor<TReference extends HTMLElement>({ data }: UseHoverPreviewAnchorOptions) {
  const context = useContext(HoverPreviewContext);
  const anchorRef = useRef<HTMLButtonElement>(null);
  const referenceRef = useRef<TReference>(null);
  const lastPointerTypeRef = useRef('');

  if (!context) throw new Error('useHoverPreviewAnchor must be used within HoverPreviewProvider.');

  const anchorProps: PreviewAnchorProps = {
    'aria-controls': 'daitign-hover-preview',
    onBlur: (event) => {
      if (context.isPreviewTarget(event.relatedTarget)) return;
      if (isTVMode()) {
        context.close({ immediate: true });
        return;
      }
      context.scheduleClose(event.currentTarget);
    },
    onClick: (event) => {
      if (isTVMode()) {
        context.performAction('details', data, event.currentTarget);
        context.close({ immediate: true });
        lastPointerTypeRef.current = '';
        return;
      }
      const pointerType = lastPointerTypeRef.current;
      const isTouchAction = (pointerType !== '' && pointerType !== 'mouse')
        || !context.supportsPointerPreview();
      context.performAction(isTouchAction ? 'details' : 'play', data, event.currentTarget);
      if (isTouchAction) context.close({ immediate: true });
      lastPointerTypeRef.current = '';
    },
    onFocus: (event) => {
      if (lastPointerTypeRef.current !== '') return;
      if (!referenceRef.current) return;
      context.requestOpen({
        anchorElement: event.currentTarget,
        data,
        referenceElement: referenceRef.current,
        source: 'keyboard',
      });
    },
    onKeyDown: (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        context.close();
        return;
      }

      if (event.key === 'Tab' && !event.shiftKey && context.focusControls()) {
        event.preventDefault();
        return;
      }

      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        if (isTVMode()) {
          context.performAction('details', data, event.currentTarget);
          context.close({ immediate: true });
          return;
        }
        context.performAction('play', data, event.currentTarget);
      }
    },
    onPointerDown: (event) => {
      lastPointerTypeRef.current = event.pointerType;
    },
    onPointerCancel: () => {
      lastPointerTypeRef.current = '';
    },
    onPointerEnter: (event) => {
      if (event.pointerType !== 'mouse' || !referenceRef.current) return;
      context.requestOpen({
        anchorElement: event.currentTarget,
        data,
        referenceElement: referenceRef.current,
        source: 'pointer',
      });
    },
    onPointerLeave: (event) => {
      if (event.pointerType === 'mouse') context.scheduleClose(event.currentTarget);
    },
  };

  return { anchorProps, anchorRef, referenceRef };
}
