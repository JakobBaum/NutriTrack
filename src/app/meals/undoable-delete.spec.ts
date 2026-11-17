import { describe, expect, it } from 'vitest';
import { UndoableDelete, settleUndoToast, undoDeleteMessage } from './undoable-delete';

function setup() {
  const committed: string[] = [];
  const del = new UndoableDelete((id) => committed.push(id));
  return { committed, del };
}

describe('UndoableDelete', () => {
  it('hides the item but does not commit before the toast ends', () => {
    const { committed, del } = setup();
    del.start('a');
    expect(del.pendingId()).toBe('a');
    expect(committed).toEqual([]);
  });

  it('restores the item on undo without committing', () => {
    const { committed, del } = setup();
    del.start('a');
    del.undo();
    del.flush();
    expect(del.pendingId()).toBeNull();
    expect(committed).toEqual([]);
  });

  it('commits the deletion on flush', () => {
    const { committed, del } = setup();
    del.start('a');
    del.flush();
    expect(del.pendingId()).toBeNull();
    expect(committed).toEqual(['a']);
  });

  it('commits a previous pending deletion when a new one starts', () => {
    const { committed, del } = setup();
    del.start('a');
    del.start('b');
    expect(committed).toEqual(['a']);
    expect(del.pendingId()).toBe('b');
  });

  it('mit stack: sammelt mehrere Löschungen, Rückgängig stellt alle wieder her', () => {
    const committed: string[] = [];
    const del = new UndoableDelete((id) => committed.push(id), { stack: true });
    del.start('a');
    del.start('b');
    expect(committed).toEqual([]);
    expect(del.pendingIds()).toEqual(['a', 'b']);

    del.undo();
    del.flush();

    expect(del.pendingIds()).toEqual([]);
    expect(committed).toEqual([]);
  });

  it('mit stack: flush löscht alle vorgemerkten endgültig', () => {
    const committed: string[] = [];
    const del = new UndoableDelete((id) => committed.push(id), { stack: true });
    del.start('a');
    del.start('b');

    del.flush();

    expect(committed).toEqual(['a', 'b']);
    expect(del.pendingId()).toBeNull();
  });

  it('mit stack: dieselbe ID wird nur einmal vorgemerkt und einmal endgültig gelöscht', () => {
    const committed: string[] = [];
    const del = new UndoableDelete((id) => committed.push(id), { stack: true });
    del.start('a');
    del.start('a');
    expect(del.pendingIds()).toEqual(['a']);
    expect(del.count()).toBe(1);
    del.flush();
    expect(committed).toEqual(['a']);
  });

  it('zählt Löschungen für einen neu startenden Hinweis (seq) und die Anzahl', () => {
    const del = new UndoableDelete(() => undefined, { stack: true });
    const before = del.seq();
    del.start('a');
    del.start('b');
    expect(del.seq()).toBe(before + 2);
    expect(del.count()).toBe(2);
    del.undo();
    expect(del.count()).toBe(0);
  });

  it('formuliert den Hinweis im Singular und Plural', () => {
    expect(undoDeleteMessage(1, 'Rezept', 'Rezepte')).toBe('Rezept gelöscht');
    expect(undoDeleteMessage(3, 'Rezept', 'Rezepte')).toBe('3 Rezepte gelöscht');
  });

  it('does nothing on flush without a pending deletion', () => {
    const { committed, del } = setup();
    del.flush();
    expect(committed).toEqual([]);
  });

  it('settles the toast by role: undo restores, anything else commits', () => {
    const first = setup();
    first.del.start('a');
    settleUndoToast(first.del, 'undo');
    expect(first.committed).toEqual([]);

    const second = setup();
    second.del.start('b');
    settleUndoToast(second.del, 'timeout');
    expect(second.committed).toEqual(['b']);
  });

  it('löscht endgültig, wenn der Hinweis weggewischt wird (Ionic-Rolle "gesture")', () => {
    const { committed, del } = setup();
    del.start('c');

    settleUndoToast(del, 'gesture');

    expect(committed).toEqual(['c']);
    expect(del.pendingId()).toBeNull();
  });
});
