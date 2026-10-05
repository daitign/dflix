import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { TvFocusEngine, type Direction, type FocusNode, type FocusRow } from './TvFocusEngine.ts';

interface TvFocusContextValue {
  activateCurrentFocus: () => boolean;
  activeNodeId: string | null;
  engine: TvFocusEngine;
  ensureInitialFocus: (preferredId?: string) => boolean;
  handleBack: () => boolean;
  move: (direction: Direction) => boolean;
  popScope: () => boolean;
  pushScope: (scopeId: string, initialNodeId?: string) => void;
  registerNode: (node: FocusNode) => void;
  registerRow: (row: FocusRow) => void;
  setFocus: (nodeId: string | null) => boolean;
  unregisterNode: (nodeId: string) => void;
  unregisterRow: (rowId: string) => void;
}

const TvFocusContext = createContext<TvFocusContextValue | null>(null);

export function TvFocusProvider({ children }: { children: ReactNode }) {
  const engine = useMemo(() => new TvFocusEngine(), []);
  const [activeNodeId, setActiveNodeId] = useState<string | null>(() => engine.getActiveNodeId());

  useEffect(() => {
    const unsubscribe = engine.subscribe((newId) => {
      setActiveNodeId(newId);
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      engine.handleKeyEvent(event);
    };

    window.addEventListener('keydown', handleKeyDown, true);

    if (typeof window !== 'undefined') {
      window.DAITIGN_TV = {
        ...window.DAITIGN_TV,
        handleRepeatKey: (direction: Direction) => engine.move(direction),
        handleBack: () => engine.handleBack(),
        handleRemoteKey: (key: string) => {
          if (key === 'OK') return engine.activateCurrentFocus();
          return false;
        },
        setFocus: (nodeId: string) => engine.setFocus(nodeId),
      } as unknown as typeof window.DAITIGN_TV;
    }

    return () => {
      unsubscribe();
      window.removeEventListener('keydown', handleKeyDown, true);
      if (typeof window !== 'undefined' && window.DAITIGN_TV) {
        delete window.DAITIGN_TV.handleRepeatKey;
        delete window.DAITIGN_TV.handleBack;
        delete window.DAITIGN_TV.handleRemoteKey;
        delete (window.DAITIGN_TV as Record<string, unknown>).setFocus;
      }
    };
  }, [engine]);

  // Referential stability: ensure callbacks never change when activeNodeId changes
  const popScope = useCallback(() => engine.popScope(), [engine]);
  const pushScope = useCallback((scopeId: string, initialNodeId?: string) => engine.pushScope(scopeId, initialNodeId), [engine]);
  const registerNode = useCallback((node: FocusNode) => engine.registerNode(node), [engine]);
  const registerRow = useCallback((row: FocusRow) => engine.registerRow(row), [engine]);
  const setFocus = useCallback((nodeId: string | null) => engine.setFocus(nodeId), [engine]);
  const unregisterNode = useCallback((nodeId: string) => engine.unregisterNode(nodeId), [engine]);
  const unregisterRow = useCallback((rowId: string) => engine.unregisterRow(rowId), [engine]);
  const move = useCallback((direction: Direction) => engine.move(direction), [engine]);
  const activateCurrentFocus = useCallback(() => engine.activateCurrentFocus(), [engine]);
  const handleBack = useCallback(() => engine.handleBack(), [engine]);
  const ensureInitialFocus = useCallback((preferredId?: string) => engine.ensureInitialFocus(preferredId), [engine]);

  const value = useMemo<TvFocusContextValue>(() => ({
    activateCurrentFocus,
    activeNodeId,
    engine,
    ensureInitialFocus,
    handleBack,
    move,
    popScope,
    pushScope,
    registerNode,
    registerRow,
    setFocus,
    unregisterNode,
    unregisterRow,
  }), [
    activateCurrentFocus,
    activeNodeId,
    engine,
    ensureInitialFocus,
    handleBack,
    move,
    popScope,
    pushScope,
    registerNode,
    registerRow,
    setFocus,
    unregisterNode,
    unregisterRow,
  ]);

  return (
    <TvFocusContext.Provider value={value}>
      {children}
    </TvFocusContext.Provider>
  );
}

export function useTvFocus() {
  const context = useContext(TvFocusContext);
  if (!context) {
    throw new Error('useTvFocus must be used within a TvFocusProvider');
  }
  return context;
}
