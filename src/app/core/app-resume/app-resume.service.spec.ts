import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { AppResumeService, RESUME_SOURCE, defaultResumeSource } from './app-resume.service';

describe('AppResumeService', () => {
  it('zählt jeden Wechsel in den Vordergrund', () => {
    let fire: () => void = () => undefined;
    TestBed.configureTestingModule({
      providers: [
        {
          provide: RESUME_SOURCE,
          useValue: (cb: () => void) => {
            fire = cb;
            return () => undefined;
          },
        },
      ],
    });
    const service = TestBed.inject(AppResumeService);
    expect(service.resumeCount()).toBe(0);
    fire();
    fire();
    expect(service.resumeCount()).toBe(2);
  });

  it('meldet die Quelle beim Zerstören ab', () => {
    const stop = vi.fn();
    TestBed.configureTestingModule({ providers: [{ provide: RESUME_SOURCE, useValue: () => stop }] });
    TestBed.inject(AppResumeService);
    TestBed.resetTestingModule();
    expect(stop).toHaveBeenCalledTimes(1);
  });
});

describe('defaultResumeSource', () => {
  it('reagiert auf visibilitychange nur im sichtbaren Zustand und räumt auf', () => {
    const onResume = vi.fn();
    const stop = defaultResumeSource(onResume);

    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    document.dispatchEvent(new Event('visibilitychange'));
    expect(onResume).not.toHaveBeenCalled();

    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    document.dispatchEvent(new Event('visibilitychange'));
    expect(onResume).toHaveBeenCalledTimes(1);

    stop();
    document.dispatchEvent(new Event('visibilitychange'));
    expect(onResume).toHaveBeenCalledTimes(1);
    vi.restoreAllMocks();
  });
});
