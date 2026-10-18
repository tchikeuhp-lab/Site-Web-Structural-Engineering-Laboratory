import { useCallback, useReducer } from 'react';
import { AuditProject } from '../types/survey';

const MAX_HISTORY = 100;
const COALESCE_MS = 1000;

interface HistoryState {
  past: AuditProject[];
  present: AuditProject;
  future: AuditProject[];
  lastKey: string | null;
  lastTime: number;
}

type Action =
  | { type: 'commit'; next: (prev: AuditProject) => AuditProject; key?: string; now: number }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'reset'; project: AuditProject };

export function historyReducer(state: HistoryState, action: Action): HistoryState {
  switch (action.type) {
    case 'commit': {
      const next = action.next(state.present);
      if (next === state.present) return state;
      // Frappes successives sur un même champ : une seule étape d'historique
      const coalesce =
        action.key !== undefined && action.key === state.lastKey && action.now - state.lastTime < COALESCE_MS;
      return {
        past: coalesce ? state.past : [...state.past, state.present].slice(-MAX_HISTORY),
        present: next,
        future: [],
        lastKey: action.key ?? null,
        lastTime: action.now,
      };
    }
    case 'undo': {
      if (state.past.length === 0) return state;
      const previous = state.past[state.past.length - 1];
      return {
        past: state.past.slice(0, -1),
        present: previous,
        future: [state.present, ...state.future],
        lastKey: null,
        lastTime: 0,
      };
    }
    case 'redo': {
      if (state.future.length === 0) return state;
      const [next, ...rest] = state.future;
      return {
        past: [...state.past, state.present],
        present: next,
        future: rest,
        lastKey: null,
        lastTime: 0,
      };
    }
    case 'reset':
      return { past: [], present: action.project, future: [], lastKey: null, lastTime: 0 };
  }
}

export function createHistoryState(project: AuditProject): HistoryState {
  return { past: [], present: project, future: [], lastKey: null, lastTime: 0 };
}

/** Projet actif avec annuler / rétablir (100 niveaux, frappes d'un même champ regroupées). */
export function useProjectHistory(initial: AuditProject) {
  const [state, dispatch] = useReducer(historyReducer, initial, createHistoryState);

  const commit = useCallback((next: (prev: AuditProject) => AuditProject, key?: string) => {
    dispatch({ type: 'commit', next, key, now: Date.now() });
  }, []);
  const undo = useCallback(() => dispatch({ type: 'undo' }), []);
  const redo = useCallback(() => dispatch({ type: 'redo' }), []);
  const reset = useCallback((project: AuditProject) => dispatch({ type: 'reset', project }), []);

  return {
    project: state.present,
    commit,
    undo,
    redo,
    reset,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
  };
}
