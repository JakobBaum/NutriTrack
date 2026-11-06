import { describe, expect, it } from 'vitest';
import { DebugLogService } from './debug-log.service';

describe('DebugLogService', () => {
  it('stellt neue Einträge voran und kennt alle Level', () => {
    const log = new DebugLogService();
    log.info('a');
    log.success('b');
    log.error('c');
    expect(log.entries().map((e) => `${e.level}:${e.msg}`)).toEqual(['error:c', 'success:b', 'info:a']);
    expect(log.entries()[0].ts).toMatch(/^\d{2}:\d{2}:\d{2}$/);
  });

  it('begrenzt auf 50 Einträge und leert per clear()', () => {
    const log = new DebugLogService();
    for (let i = 0; i < 60; i++) log.info(`m${i}`);
    expect(log.entries()).toHaveLength(50);
    expect(log.entries()[0].msg).toBe('m59');
    log.clear();
    expect(log.entries()).toEqual([]);
  });
});
