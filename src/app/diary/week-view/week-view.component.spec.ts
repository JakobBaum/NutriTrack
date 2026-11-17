import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppResumeService } from '../../core/app-resume/app-resume.service';
import { DiaryStore } from '../../core/state/diary.store';
import { NumPipe } from '../../shared/num.pipe';
import { WeekViewComponent } from './week-view.component';

const resumeCount = signal(0);

function setup(): WeekViewComponent {
  localStorage.clear();
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [NumPipe],
    declarations: [WeekViewComponent],
    providers: [{ provide: AppResumeService, useValue: { resumeCount } }],
  });
  const fixture = TestBed.createComponent(WeekViewComponent);
  fixture.detectChanges();
  return fixture.componentInstance;
}

describe('WeekViewComponent', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 14, 23, 50));
    resumeCount.set(0);
  });
  afterEach(() => vi.useRealTimers());

  it('rückt nach Mitternacht beim Zurückkehren in die App auf den neuen Tag (T12)', () => {
    const c = setup();
    expect(c.kcalChart().bars.at(-1)?.dateISO).toBe('2026-11-14');
    vi.setSystemTime(new Date(2026, 10, 15, 0, 5));
    resumeCount.update((n) => n + 1);
    TestBed.tick();
    expect(c.kcalChart().bars.at(-1)?.dateISO).toBe('2026-11-15');
  });

  it('nennt Wert je Balken und das Ziel in Text (U18)', () => {
    const c = setup();
    TestBed.inject(DiaryStore).add({
      dateISO: '2026-11-14', meal: 'lunch', label: 'Reis',
      facts: { kcal: 1850, proteinG: 90, carbsG: 0, fatG: 0, basis: 'perPortion' },
    });
    const last = c.kcalChart().bars.at(-1);
    expect(last?.valueText).toBe('1850');
    expect(c.kcalChart().bars[0].valueText).toBe('–');
    expect(c.kcalChart().description).toMatch(/1[^\d]?850 kcal/);
  });
});
