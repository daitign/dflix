/**
 * TV V2 Focus Engine.
 * A high-performance, deterministic registered 2D spatial grid.
 *
 * Core architectural differences from TV V1:
 * - NO querySelectorAll / DOM attribute scanning on navigation.
 * - NO getBoundingClientRect layout thrashing.
 * - NO MutationObserver invalidating caches on focus state change.
 * - Pure registration model with $O(1)$ directional indexing.
 * - Dedicated focus stack for modals, submenus, and player.
 * - Deterministic memory of last-focused card per row.
 */

export type Direction = 'up' | 'down' | 'left' | 'right';
export type TvKeyAction = 'up' | 'down' | 'left' | 'right' | 'select' | 'back';

export function parseTvKeyEvent(event: KeyboardEvent): TvKeyAction | null {
  const key = event.key;
  const keyCode = event.keyCode || event.which;
  const target = event.target as HTMLElement | null;
  const isInput =
    Boolean(target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) ||
    (typeof document !== 'undefined' &&
      document.activeElement &&
      (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA'));

  if (key === 'ArrowUp' || key === 'Up' || keyCode === 38 || keyCode === 19) return 'up';
  if (key === 'ArrowDown' || key === 'Down' || keyCode === 40 || keyCode === 20) return 'down';
  if (key === 'ArrowLeft' || key === 'Left' || keyCode === 37 || keyCode === 21) return 'left';
  if (key === 'ArrowRight' || key === 'Right' || keyCode === 39 || keyCode === 22) return 'right';

  // Space inside text input is a character, not TV select button
  if ((key === ' ' || keyCode === 32) && isInput) {
    return null;
  }

  if (
    key === 'Enter' ||
    key === 'Select' ||
    key === 'NumpadEnter' ||
    key === ' ' ||
    keyCode === 13 ||
    keyCode === 32 ||
    keyCode === 23 || // KEYCODE_DPAD_CENTER
    keyCode === 66 || // KEYCODE_ENTER
    keyCode === 160 || // KEYCODE_NUMPAD_ENTER
    keyCode === 108   // KEYCODE_NUMPAD_ENTER (browser)
  ) {
    return 'select';
  }

  // Backspace inside text input with characters should delete character
  if (isInput && (key === 'Backspace' || keyCode === 8)) {
    const inputEl = (target as HTMLInputElement) || (document.activeElement as HTMLInputElement);
    if (inputEl && inputEl.value && inputEl.value.length > 0) {
      return null;
    }
  }

  if (
    key === 'Escape' ||
    key === 'Backspace' ||
    key === 'Back' ||
    key === 'GoBack' ||
    keyCode === 27 ||
    keyCode === 8 ||
    keyCode === 4 || // KEYCODE_BACK (Android TV)
    keyCode === 10009 || // Tizen
    keyCode === 461 // webOS
  ) {
    return 'back';
  }

  return null;
}

export interface FocusNode {
  colIndex: number;
  disabled?: boolean;
  id: string;
  metadata?: unknown;
  onBack?: () => boolean | void;
  onBlur?: () => void;
  onFocus?: () => void;
  onSelect?: () => void;
  rowId: string;
}

export interface FocusRow {
  id: string;
  order: number;
  wrapHorizontal?: boolean;
}

export type FocusChangeListener = (activeId: string | null, prevId: string | null) => void;

export class TvFocusEngine {
  private nodes = new Map<string, FocusNode>();
  private rows = new Map<string, FocusRow>();
  private rowNodeMap = new Map<string, string[]>(); // rowId -> sorted node IDs by colIndex
  private rowFocusMemory = new Map<string, string>(); // rowId -> last focused nodeId
  private focusStack: Array<{ activeId: string | null; scopeId: string }> = [];
  private activeScope = 'root';
  private activeNodeId: string | null = null;
  private listeners = new Set<FocusChangeListener>();

  private customKeyHandler: ((event: KeyboardEvent) => boolean) | null = null;
  private onBackFallback: (() => boolean) | null = null;

  private keyRepeatThrottleAt = 0;
  private readonly KEY_REPEAT_INTERVAL_MS = 75;

  constructor(initialScope = 'root') {
    this.activeScope = initialScope;
  }

  public setCustomKeyHandler(handler: ((event: KeyboardEvent) => boolean) | null): void {
    this.customKeyHandler = handler;
  }

  public setOnBackFallback(fallback: (() => boolean) | null): void {
    this.onBackFallback = fallback;
  }

  // -------------------------------------------------------------
  // Node & Row Registration
  // -------------------------------------------------------------

  public registerRow(row: FocusRow): void {
    this.rows.set(row.id, { ...row });
    if (!this.rowNodeMap.has(row.id)) {
      this.rowNodeMap.set(row.id, []);
    }
  }

  public unregisterRow(rowId: string): void {
    this.rows.delete(rowId);
    // Note: Do NOT delete this.rowNodeMap.get(rowId) here, as child nodes may still be registered.
    // rowNodeMap is properly cleaned up per-node by unregisterNode.
  }

  public registerNode(node: FocusNode): void {
    const existing = this.nodes.get(node.id);
    this.nodes.set(node.id, { ...node });

    // Update row node list
    let list = this.rowNodeMap.get(node.rowId);
    if (!list) {
      list = [];
      this.rowNodeMap.set(node.rowId, list);
    }

    if (!list.includes(node.id)) {
      list.push(node.id);
    }

    // Sort list by colIndex
    list.sort((a, b) => {
      const nodeA = this.nodes.get(a);
      const nodeB = this.nodes.get(b);
      return (nodeA?.colIndex ?? 0) - (nodeB?.colIndex ?? 0);
    });

    // If no node is focused yet, focus the first registered valid node
    if (!this.activeNodeId && !node.disabled) {
      this.setFocus(node.id);
    } else if (existing?.disabled && !node.disabled && !this.activeNodeId) {
      this.setFocus(node.id);
    }
  }

  public unregisterNode(nodeId: string): void {
    const node = this.nodes.get(nodeId);
    if (!node) return;

    this.nodes.delete(nodeId);

    const list = this.rowNodeMap.get(node.rowId);
    if (list) {
      const idx = list.indexOf(nodeId);
      if (idx >= 0) list.splice(idx, 1);
    }

    if (this.rowFocusMemory.get(node.rowId) === nodeId) {
      this.rowFocusMemory.delete(node.rowId);
    }

    if (this.activeNodeId === nodeId) {
      // Pick neighbor in the same row if available
      const remaining = list?.filter((id) => !this.nodes.get(id)?.disabled) ?? [];
      if (remaining.length > 0) {
        this.setFocus(remaining[0]);
      } else {
        this.activeNodeId = null;
        this.notifyListeners(null, nodeId);
      }
    }
  }

  // -------------------------------------------------------------
  // Focus State Management
  // -------------------------------------------------------------

  public getActiveNodeId(): string | null {
    return this.activeNodeId;
  }

  public getActiveNode(): FocusNode | null {
    return this.activeNodeId ? (this.nodes.get(this.activeNodeId) ?? null) : null;
  }

  public getNode(id: string): FocusNode | null {
    return this.nodes.get(id) ?? null;
  }

  public setFocus(nodeId: string | null): boolean {
    if (nodeId === this.activeNodeId) return true;

    const prevId = this.activeNodeId;
    const prevNode = prevId ? this.nodes.get(prevId) : null;

    if (nodeId === null) {
      this.activeNodeId = null;
      prevNode?.onBlur?.();
      this.notifyListeners(null, prevId);
      return true;
    }

    const nextNode = this.nodes.get(nodeId);
    if (!nextNode || nextNode.disabled) return false;

    this.activeNodeId = nodeId;
    this.rowFocusMemory.set(nextNode.rowId, nodeId);

    prevNode?.onBlur?.();
    nextNode.onFocus?.();
    this.notifyListeners(nodeId, prevId);

    // Synchronize DOM focus if element exists, preventing scroll
    if (typeof document !== 'undefined') {
      const domEl = document.getElementById(nodeId);
      if (domEl && typeof domEl.focus === 'function' && document.activeElement !== domEl) {
        try {
          domEl.focus({ preventScroll: true });
        } catch {}
      }
      this.repositionViewportForRow(nextNode.rowId);
    }

    return true;
  }

  public subscribe(listener: FocusChangeListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(activeId: string | null, prevId: string | null): void {
    this.listeners.forEach((listener) => {
      try {
        listener(activeId, prevId);
      } catch (err) {
        console.error('[TvFocusEngine] listener error', err);
      }
    });
  }

  // -------------------------------------------------------------
  // Scopes & Focus Stack (For Modals, Submenus, Fullscreen Player)
  // -------------------------------------------------------------

  public pushScope(scopeId: string, initialNodeId?: string): void {
    this.focusStack.push({
      activeId: this.activeNodeId,
      scopeId: this.activeScope,
    });
    this.activeScope = scopeId;
    if (initialNodeId) {
      this.setFocus(initialNodeId);
    }
  }

  public popScope(): boolean {
    if (this.focusStack.length === 0) return false;
    const previous = this.focusStack.pop()!;
    this.activeScope = previous.scopeId;
    if (previous.activeId && this.nodes.has(previous.activeId)) {
      this.setFocus(previous.activeId);
    }
    return true;
  }

  public getScope(): string {
    return this.activeScope;
  }

  // -------------------------------------------------------------
  // Deterministic 2D Navigation
  // -------------------------------------------------------------

  public move(direction: Direction): boolean {
    return this.navigate(direction);
  }

  public ensureInitialFocus(preferredId?: string): boolean {
    if (this.activeNodeId && this.nodes.has(this.activeNodeId)) {
      const current = this.nodes.get(this.activeNodeId);
      if (current && !current.disabled) return true;
    }

    if (preferredId && this.nodes.has(preferredId)) {
      const pref = this.nodes.get(preferredId);
      if (pref && !pref.disabled) {
        return this.setFocus(preferredId);
      }
    }

    if (this.nodes.has('nav-home')) {
      const node = this.nodes.get('nav-home');
      if (node && !node.disabled) return this.setFocus('nav-home');
    }

    if (this.nodes.has('hero-play')) {
      const node = this.nodes.get('hero-play');
      if (node && !node.disabled) return this.setFocus('hero-play');
    }

    const first = Array.from(this.nodes.values()).find((n) => !n.disabled);
    if (first) {
      return this.setFocus(first.id);
    }

    return false;
  }

  public activateCurrentFocus(): boolean {
    const active = this.getActiveNode();
    if (active && !active.disabled && active.onSelect) {
      active.onSelect();
      return true;
    }
    return false;
  }

  public handleBack(): boolean {
    const active = this.getActiveNode();
    if (active?.onBack) {
      const handled = active.onBack();
      if (handled !== false) return true;
    }

    if (this.focusStack.length > 0) {
      return this.popScope();
    }

    if (this.onBackFallback) {
      return this.onBackFallback();
    }

    return false;
  }

  public navigate(direction: Direction): boolean {
    if (!this.activeNodeId || !this.nodes.has(this.activeNodeId)) {
      return this.ensureInitialFocus();
    }

    const currentNode = this.nodes.get(this.activeNodeId);
    if (!currentNode) return false;

    if (direction === 'left' || direction === 'right') {
      return this.navigateHorizontal(currentNode, direction);
    }

    return this.navigateVertical(currentNode, direction);
  }

  private navigateHorizontal(current: FocusNode, direction: 'left' | 'right'): boolean {
    const list = this.rowNodeMap.get(current.rowId) ?? [];
    const enabledList = list.filter((id) => !this.nodes.get(id)?.disabled);
    const currentIndex = enabledList.indexOf(current.id);

    if (currentIndex < 0) return false;

    const row = this.rows.get(current.rowId);
    const wrap = row?.wrapHorizontal ?? false;

    let nextIndex = direction === 'right' ? currentIndex + 1 : currentIndex - 1;

    if (nextIndex < 0) {
      if (wrap) nextIndex = enabledList.length - 1;
      else return false;
    } else if (nextIndex >= enabledList.length) {
      if (wrap) nextIndex = 0;
      else return false;
    }

    const nextId = enabledList[nextIndex];
    if (nextId) {
      return this.setFocus(nextId);
    }
    return false;
  }

  private navigateVertical(current: FocusNode, direction: 'up' | 'down'): boolean {
    // Collect rows sorted by order
    const sortedRows = Array.from(this.rows.values()).sort((a, b) => a.order - b.order);
    const currentRowIndex = sortedRows.findIndex((r) => r.id === current.rowId);

    if (currentRowIndex < 0) return false;

    let targetRowIndex = currentRowIndex;
    const step = direction === 'down' ? 1 : -1;

    while (true) {
      targetRowIndex += step;
      if (targetRowIndex < 0 || targetRowIndex >= sortedRows.length) {
        return false;
      }

      const candidateRow = sortedRows[targetRowIndex];
      const targetNodes = (this.rowNodeMap.get(candidateRow.id) ?? []).filter(
        (id) => !this.nodes.get(id)?.disabled
      );

      if (targetNodes.length === 0) {
        // Row is empty or all items disabled, continue scanning in direction
        continue;
      }

      // Found valid targetRow with enabled nodes!
      // When transitioning between nav-row and content, prioritize closest column match over stale memory
      const isNavTransition = current.rowId === 'nav-row' || candidateRow.id === 'nav-row';
      if (!isNavTransition) {
        const rememberedId = this.rowFocusMemory.get(candidateRow.id);
        if (rememberedId && targetNodes.includes(rememberedId)) {
          return this.setFocus(rememberedId);
        }
      }

      // Match closest column index
      const closest = targetNodes.reduce((prev, currId) => {
        const prevNode = this.nodes.get(prev);
        const currNode = this.nodes.get(currId);
        if (!prevNode || !currNode) return currId;

        const prevDiff = Math.abs(prevNode.colIndex - current.colIndex);
        const currDiff = Math.abs(currNode.colIndex - current.colIndex);
        return currDiff < prevDiff ? currId : prev;
      }, targetNodes[0]);

      if (closest) {
        return this.setFocus(closest);
      }
      return false;
    }
  }

  private repositionViewportForRow(rowId: string): void {
    if (typeof document === 'undefined') return;

    if (rowId === 'nav-row' || rowId === 'hero-row') {
      if (typeof window !== 'undefined' && typeof window.scrollTo === 'function') {
        try {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        } catch {
          window.scrollTo(0, 0);
        }
      }
      return;
    }

    if (rowId === 'footer-row') {
      if (typeof window !== 'undefined' && typeof window.scrollTo === 'function') {
        const docHeight = document.documentElement?.scrollHeight || 10000;
        try {
          window.scrollTo({ top: docHeight, behavior: 'smooth' });
        } catch {
          window.scrollTo(0, docHeight);
        }
      }
      return;
    }

    const rowEl = document.querySelector(`[data-row-id="${rowId}"]`) || document.getElementById(rowId);
    if (!rowEl) return;

    // Check if inside a custom scrollable container (e.g. detail modal)
    const scrollContainer = rowEl.closest('.tv-v2-detail__scrollable');
    if (scrollContainer) {
      try {
        const containerRect = scrollContainer.getBoundingClientRect();
        const rowRect = rowEl.getBoundingClientRect();
        const relativeTop = rowRect.top - containerRect.top + scrollContainer.scrollTop;
        const targetY = Math.max(0, relativeTop - 120);
        scrollContainer.scrollTo({ top: targetY, behavior: 'smooth' });
      } catch {
        // fallback
      }
      return;
    }

    if (typeof window !== 'undefined' && typeof window.scrollTo === 'function') {
      try {
        const rowRect = rowEl.getBoundingClientRect();
        const currentScrollY = window.scrollY || window.pageYOffset || 0;
        const absoluteTop = rowRect.top + currentScrollY;
        const targetY = Math.max(0, absoluteTop - 180);
        window.scrollTo({ top: targetY, behavior: 'smooth' });
      } catch {
        // ignore in testing environments without layout
      }
    }
  }

  // -------------------------------------------------------------
  // Keyboard & D-Pad Remote Dispatcher
  // -------------------------------------------------------------

  public handleKeyEvent(event: KeyboardEvent): boolean {
    if (this.customKeyHandler) {
      const handled = this.customKeyHandler(event);
      if (handled) return true;
    }

    const action = parseTvKeyEvent(event);
    if (!action) return false;

    // Prevent default browser scroll / navigation for TV remote keys
    event.preventDefault();
    event.stopPropagation();

    const now = performance.now();
    if (event.repeat) {
      if (now - this.keyRepeatThrottleAt < this.KEY_REPEAT_INTERVAL_MS) {
        return true;
      }
    }
    this.keyRepeatThrottleAt = now;

    if (action === 'up' || action === 'down' || action === 'left' || action === 'right') {
      if (!this.activeNodeId || !this.nodes.has(this.activeNodeId)) {
        return this.ensureInitialFocus();
      }
      return this.move(action);
    }

    if (action === 'select') {
      return this.activateCurrentFocus();
    }

    if (action === 'back') {
      return this.handleBack();
    }

    return false;
  }

  public clear(): void {
    this.nodes.clear();
    this.rows.clear();
    this.rowNodeMap.clear();
    this.rowFocusMemory.clear();
    this.focusStack = [];
    this.activeNodeId = null;
    this.listeners.clear();
  }
}
