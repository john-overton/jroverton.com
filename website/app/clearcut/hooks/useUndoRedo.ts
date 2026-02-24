import { useCallback, useRef } from 'react';

const MAX_HISTORY = 10;

export function useUndoRedo<T>() {
  const undoStack = useRef<T[]>([]);
  const redoStack = useRef<T[]>([]);

  const pushState = useCallback((current: T) => {
    undoStack.current = [...undoStack.current.slice(-MAX_HISTORY + 1), current];
    redoStack.current = [];
  }, []);

  const undo = useCallback((current: T): T | null => {
    if (undoStack.current.length === 0) return null;
    const previous = undoStack.current[undoStack.current.length - 1];
    undoStack.current = undoStack.current.slice(0, -1);
    redoStack.current = [...redoStack.current, current];
    return previous;
  }, []);

  const redo = useCallback((current: T): T | null => {
    if (redoStack.current.length === 0) return null;
    const next = redoStack.current[redoStack.current.length - 1];
    redoStack.current = redoStack.current.slice(0, -1);
    undoStack.current = [...undoStack.current, current];
    return next;
  }, []);

  const clearHistory = useCallback(() => {
    undoStack.current = [];
    redoStack.current = [];
  }, []);

  const canUndo = undoStack.current.length > 0;
  const canRedo = redoStack.current.length > 0;

  return { pushState, undo, redo, clearHistory, canUndo, canRedo };
}
