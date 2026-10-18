import { describe, expect, it } from 'vitest';
import { createHistoryState, historyReducer } from '../useProjectHistory';
import { createEmptyProject } from '../../storage/projectStore';

const base = createEmptyProject({ title: 'A' });
const rename = (title: string) => (p: typeof base) => ({ ...p, title });

describe('historique annuler / rétablir', () => {
  it('undo puis redo', () => {
    let s = createHistoryState(base);
    s = historyReducer(s, { type: 'commit', next: rename('B'), now: 0 });
    s = historyReducer(s, { type: 'commit', next: rename('C'), now: 10_000 });
    expect(s.present.title).toBe('C');
    s = historyReducer(s, { type: 'undo' });
    expect(s.present.title).toBe('B');
    s = historyReducer(s, { type: 'redo' });
    expect(s.present.title).toBe('C');
  });

  it('une nouvelle action vide la pile « rétablir »', () => {
    let s = createHistoryState(base);
    s = historyReducer(s, { type: 'commit', next: rename('B'), now: 0 });
    s = historyReducer(s, { type: 'undo' });
    s = historyReducer(s, { type: 'commit', next: rename('X'), now: 10_000 });
    expect(s.future).toHaveLength(0);
  });

  it('regroupe les frappes rapides d’un même champ en une seule étape', () => {
    let s = createHistoryState(base);
    for (const [i, t] of ['B', 'BC', 'BCD'].entries()) {
      s = historyReducer(s, { type: 'commit', next: rename(t), key: 'title', now: i * 100 });
    }
    expect(s.past).toHaveLength(1);
    s = historyReducer(s, { type: 'undo' });
    expect(s.present.title).toBe('A');
  });

  it('ne regroupe pas au-delà du délai', () => {
    let s = createHistoryState(base);
    s = historyReducer(s, { type: 'commit', next: rename('B'), key: 'title', now: 0 });
    s = historyReducer(s, { type: 'commit', next: rename('C'), key: 'title', now: 5000 });
    expect(s.past).toHaveLength(2);
  });

  it('plafonne l’historique à 100 étapes et reset le vide', () => {
    let s = createHistoryState(base);
    for (let i = 0; i < 150; i++) s = historyReducer(s, { type: 'commit', next: rename(`T${i}`), now: i * 5000 });
    expect(s.past).toHaveLength(100);
    s = historyReducer(s, { type: 'reset', project: base });
    expect(s.past).toHaveLength(0);
  });
});
