import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RESUME_SOURCE } from '../../core/app-resume/app-resume.service';
import { injectToday } from './use-today';

describe('injectToday', () => {
  afterEach(() => vi.useRealTimers());

  it('rechnet nach Mitternacht beim Zurückkehren in die App den neuen Tag', () => {
    // Arrange
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 14, 23, 50));
    let fire: () => void = () => undefined;
    TestBed.configureTestingModule({
      providers: [{ provide: RESUME_SOURCE, useValue: (cb: () => void) => { fire = cb; return () => undefined; } }],
    });
    const today = TestBed.runInInjectionContext(() => injectToday());
    TestBed.tick();
    expect(today()).toBe('2026-11-14');

    // Act
    vi.setSystemTime(new Date(2026, 10, 15, 0, 5));
    fire();
    TestBed.tick();

    // Assert
    expect(today()).toBe('2026-11-15');
  });
});
