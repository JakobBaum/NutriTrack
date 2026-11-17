import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RESUME_SOURCE } from '../core/app-resume/app-resume.service';
import { WeightStore } from '../core/state/weight.store';
import { NumPipe } from '../shared/num.pipe';
import { WeightTileComponent } from './weight-tile.component';

describe('WeightTileComponent', () => {
  afterEach(() => vi.useRealTimers());

  it('rechnet "heute eingetragen" nach Mitternacht neu, sobald die App zurückkehrt', () => {
    // Arrange
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 14, 23, 50));
    localStorage.clear();
    let fire: () => void = () => undefined;
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      declarations: [WeightTileComponent],
      imports: [NumPipe],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
      providers: [{ provide: RESUME_SOURCE, useValue: (cb: () => void) => { fire = cb; return () => undefined; } }],
    });
    TestBed.inject(WeightStore).set('2026-11-14', 80);
    const fixture = TestBed.createComponent(WeightTileComponent);
    fixture.detectChanges();
    expect(fixture.componentInstance.hasToday()).toBe(true);

    // Act
    vi.setSystemTime(new Date(2026, 10, 15, 0, 5));
    fire();
    TestBed.tick();

    // Assert
    expect(fixture.componentInstance.hasToday()).toBe(false);
  });
});
