import { describe, expect, it } from 'vitest';
import { UndoableDelete, settleUndoToast } from './undoable-delete';

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
