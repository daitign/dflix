/**
 * TV V2 Fullscreen Player State Machine.
 *
 * Implements an explicit state machine for TV player controls:
 * - Guarantees controls NEVER auto-close while any menu, drawer, or selector is open.
 * - Inactivity timer operates ONLY in CONTROLS_VISIBLE.
 * - Any D-pad or remote interaction resets the timer.
 * - D-pad hold maintains active state.
 * - Back button strictly closes open submenus before hiding controls or exiting.
 */

export type PlayerState =
  | 'PLAYER_IDLE'
  | 'CONTROLS_VISIBLE'
  | 'MENU_OPEN'
  | 'SEEKING'
  | 'EPISODE_SELECTOR_OPEN'
  | 'SUBTITLE_SELECTOR_OPEN'
  | 'SERVER_SELECTOR_OPEN';

export type PlayerStateListener = (state: PlayerState, prevState: PlayerState) => void;

export class TvPlayerStateMachine {
  private currentState: PlayerState = 'PLAYER_IDLE';
  private idleTimer: number | null = null;
  private readonly IDLE_TIMEOUT_MS: number;
  private listeners = new Set<PlayerStateListener>();

  constructor(idleTimeoutMs = 5000) {
    this.IDLE_TIMEOUT_MS = idleTimeoutMs;
  }

  public getState(): PlayerState {
    return this.currentState;
  }

  public isControlsVisible(): boolean {
    return this.currentState !== 'PLAYER_IDLE';
  }

  public isSubmenuOpen(): boolean {
    return (
      this.currentState === 'MENU_OPEN' ||
      this.currentState === 'EPISODE_SELECTOR_OPEN' ||
      this.currentState === 'SUBTITLE_SELECTOR_OPEN' ||
      this.currentState === 'SERVER_SELECTOR_OPEN' ||
      this.currentState === 'SEEKING'
    );
  }

  // -------------------------------------------------------------
  // State Transitions
  // -------------------------------------------------------------

  public showControls(): void {
    if (this.currentState === 'PLAYER_IDLE') {
      this.setState('CONTROLS_VISIBLE');
      this.resetIdleTimer();
    } else if (this.currentState === 'CONTROLS_VISIBLE') {
      this.resetIdleTimer();
    }
  }

  public hideControls(): void {
    this.clearIdleTimer();
    this.setState('PLAYER_IDLE');
  }

  public openSettings(): void {
    this.clearIdleTimer();
    this.setState('MENU_OPEN');
  }

  public openEpisodes(): void {
    this.clearIdleTimer();
    this.setState('EPISODE_SELECTOR_OPEN');
  }

  public openSubtitles(): void {
    this.clearIdleTimer();
    this.setState('SUBTITLE_SELECTOR_OPEN');
  }

  public openServers(): void {
    this.clearIdleTimer();
    this.setState('SERVER_SELECTOR_OPEN');
  }

  public startSeeking(): void {
    this.clearIdleTimer();
    this.setState('SEEKING');
  }

  public closeSubmenu(): void {
    if (this.isSubmenuOpen()) {
      this.setState('CONTROLS_VISIBLE');
      this.resetIdleTimer();
    }
  }

  // -------------------------------------------------------------
  // Remote Interaction & Back Button Dispatch
  // -------------------------------------------------------------

  /**
   * Called on every relevant remote keypress.
   * If in CONTROLS_VISIBLE, restarts the idle countdown.
   * If already in a submenu, timer remains stopped.
   */
  public onUserInteraction(): void {
    if (this.currentState === 'PLAYER_IDLE') {
      this.showControls();
    } else if (this.currentState === 'CONTROLS_VISIBLE') {
      this.resetIdleTimer();
    }
    // Submenus never run the idle timer
  }

  /**
   * Handles the TV remote Back button deterministically:
   * 1. If any submenu / selector / scrub is open -> close it, return to CONTROLS_VISIBLE (return true).
   * 2. If controls are visible -> hide controls to PLAYER_IDLE (return true).
   * 3. If in PLAYER_IDLE -> returns false (indicates player can be exited).
   */
  public handleBack(): boolean {
    if (this.isSubmenuOpen()) {
      this.closeSubmenu();
      return true;
    }

    if (this.currentState === 'CONTROLS_VISIBLE') {
      this.hideControls();
      return true;
    }

    return false;
  }

  // -------------------------------------------------------------
  // Timer Management
  // -------------------------------------------------------------

  private resetIdleTimer(): void {
    this.clearIdleTimer();
    if (this.currentState !== 'CONTROLS_VISIBLE') return;

    this.idleTimer = setTimeout(() => {
      this.idleTimer = null;
      if (this.currentState === 'CONTROLS_VISIBLE') {
        this.setState('PLAYER_IDLE');
      }
    }, this.IDLE_TIMEOUT_MS) as unknown as number;
  }

  private clearIdleTimer(): void {
    if (this.idleTimer !== null) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
  }

  private setState(next: PlayerState): void {
    if (this.currentState === next) return;
    const prev = this.currentState;
    this.currentState = next;
    this.listeners.forEach((listener) => {
      try {
        listener(next, prev);
      } catch (err) {
        console.error('[TvPlayerStateMachine] listener error', err);
      }
    });
  }

  public subscribe(listener: PlayerStateListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public destroy(): void {
    this.clearIdleTimer();
    this.listeners.clear();
  }
}
