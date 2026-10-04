import { useCallback, useEffect, useRef } from 'react';
import { useTvFocus } from './TvFocusContext.tsx';
import type { FocusNode, FocusRow } from './TvFocusEngine.ts';

export interface UseTvFocusNodeOptions extends Omit<FocusNode, 'id'> {
  id: string;
}

export function useTvFocusNode(options: UseTvFocusNodeOptions) {
  const { activeNodeId, registerNode, setFocus, unregisterNode } = useTvFocus();
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const isFocused = activeNodeId === options.id;

  useEffect(() => {
    registerNode({
      colIndex: options.colIndex,
      disabled: options.disabled,
      id: options.id,
      metadata: options.metadata,
      onBack: () => optionsRef.current.onBack?.(),
      onBlur: () => optionsRef.current.onBlur?.(),
      onFocus: () => optionsRef.current.onFocus?.(),
      onSelect: () => optionsRef.current.onSelect?.(),
      rowId: options.rowId,
    });

    return () => {
      unregisterNode(options.id);
    };
  }, [options.colIndex, options.disabled, options.id, options.rowId, registerNode, unregisterNode]);

  const requestFocus = useCallback(() => setFocus(options.id), [options.id, setFocus]);

  return {
    isFocused,
    requestFocus,
  };
}

export function useTvFocusRow(row: FocusRow) {
  const { registerRow, unregisterRow } = useTvFocus();

  useEffect(() => {
    registerRow(row);
    return () => {
      unregisterRow(row.id);
    };
  }, [registerRow, row.id, row.order, row.wrapHorizontal, unregisterRow]);
}
