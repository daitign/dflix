/**
 * TV V2 Preview Manager.
 * Guarantees the Single Active Preview invariant across the entire TV app:
 * - At most ONE preview video may be active or loading at any moment.
 * - Enforces intentional focus settling delay (500ms) before loading video.
 * - Moving focus immediately aborts any pending preview and unloads active iframe.
 * - Audio arbitration: sound is ON by default for TV V2, session mute preference remembered.
 * - Zero overlapping video or audio playback.
 */

export type PreviewListener = (activePreviewId: string | null, isMuted: boolean) => void;

export interface PreviewRequestOptions {
  delayMs?: number;
  onError?: () => void;
  onReady?: () => void;
}

export class TvPreviewManager {
  private static instance: TvPreviewManager | null = null;

  private activePreviewId: string | null = null;
  private pendingTimer: number | null = null;
  private pendingId: string | null = null;
  private isMuted = false; // TV V2 default: sound ON
  private listeners = new Set<PreviewListener>();

  public static getInstance(): TvPreviewManager {
    if (!TvPreviewManager.instance) {
      TvPreviewManager.instance = new TvPreviewManager();
    }
    return TvPreviewManager.instance;
  }

  // -------------------------------------------------------------
  // Preview Lifecycle
  // -------------------------------------------------------------

  public requestPreview(id: string, options: PreviewRequestOptions = {}): void {
    const delay = options.delayMs ?? 500;

    // If already active on this ID, keep it
    if (this.activePreviewId === id) return;

    // Cancel any pending timer
    this.cancelPending();

    // If another preview is active, stop it immediately
    if (this.activePreviewId && this.activePreviewId !== id) {
      this.stopActive();
    }

    this.pendingId = id;

    if (delay <= 0) {
      this.activate(id);
      return;
    }

    this.pendingTimer = setTimeout(() => {
      this.pendingTimer = null;
      if (this.pendingId === id) {
        this.activate(id);
      }
    }, delay) as unknown as number;
  }

  private activate(id: string): void {
    this.activePreviewId = id;
    this.pendingId = null;
    this.notify();
  }

  private baselineHeroId: string | null = null;
  private heroResumeTimer: number | null = null;

  public registerHero(id: string, options: PreviewRequestOptions = {}): void {
    this.baselineHeroId = id;
    if (!this.activePreviewId || this.activePreviewId === id) {
      this.requestPreview(id, options);
    }
  }

  public unregisterHero(id: string): void {
    if (this.baselineHeroId === id) {
      this.baselineHeroId = null;
      if (this.heroResumeTimer !== null) {
        clearTimeout(this.heroResumeTimer);
        this.heroResumeTimer = null;
      }
      if (this.activePreviewId === id) {
        this.stopActive();
      }
    }
  }

  public resumeHero(delayMs = 500): void {
    if (!this.baselineHeroId) return;
    if (this.heroResumeTimer !== null) {
      clearTimeout(this.heroResumeTimer);
    }
    this.heroResumeTimer = setTimeout(() => {
      this.heroResumeTimer = null;
      if (!this.activePreviewId && this.baselineHeroId) {
        this.requestPreview(this.baselineHeroId, { delayMs: 0 });
      }
    }, delayMs) as unknown as number;
  }

  public cancelPending(): void {
    if (this.pendingTimer !== null) {
      clearTimeout(this.pendingTimer);
      this.pendingTimer = null;
    }
    if (this.heroResumeTimer !== null) {
      clearTimeout(this.heroResumeTimer);
      this.heroResumeTimer = null;
    }
    this.pendingId = null;
  }

  public stopActive(): void {
    this.cancelPending();
    if (this.activePreviewId !== null) {
      this.activePreviewId = null;
      this.notify();
    }
  }

  public stop(id?: string): void {
    const wasHero = Boolean(id && id === this.baselineHeroId);
    if (!id || this.activePreviewId === id || this.pendingId === id) {
      this.cancelPending();
      this.stopActive();
      if (!wasHero && this.baselineHeroId) {
        this.resumeHero(500);
      }
    }
  }

  public isPreviewActive(id: string): boolean {
    return this.activePreviewId === id;
  }

  public getActivePreviewId(): string | null {
    return this.activePreviewId;
  }

  // -------------------------------------------------------------
  // Audio Arbitration
  // -------------------------------------------------------------

  public getIsMuted(): boolean {
    return this.isMuted;
  }

  public setMuted(muted: boolean): void {
    if (this.isMuted !== muted) {
      this.isMuted = muted;
      this.notify();
    }
  }

  public toggleMute(): boolean {
    this.setMuted(!this.isMuted);
    return this.isMuted;
  }

  // -------------------------------------------------------------
  // Subscriptions & Cleanup
  // -------------------------------------------------------------

  public subscribe(listener: PreviewListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    this.listeners.forEach((listener) => {
      try {
        listener(this.activePreviewId, this.isMuted);
      } catch (err) {
        console.error('[TvPreviewManager] listener error', err);
      }
    });
  }

  public reset(): void {
    this.stopActive();
    this.isMuted = false;
    this.listeners.clear();
  }
}

export const tvPreviewManager = TvPreviewManager.getInstance();
