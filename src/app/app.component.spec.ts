import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ToastController } from '@ionic/angular';
import { vi } from 'vitest';

import { AppComponent, STORAGE_WRITE_ERROR_MESSAGE } from './app.component';
import { StorageService } from './core/storage/storage.service';

describe('AppComponent', () => {
  const present = vi.fn().mockResolvedValue(undefined);
  const create = vi.fn().mockResolvedValue({ present });

  beforeEach(async () => {
    create.mockClear();
    await TestBed.configureTestingModule({
      declarations: [AppComponent],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
      providers: [{ provide: ToastController, useValue: { create } }],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('meldet einen fehlgeschlagenen Schreibzugriff per Toast (QAE-02)', async () => {
    const storage = TestBed.inject(StorageService);
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: () => { throw new Error('QuotaExceededError'); },
    });

    storage.set('diary', []);
    fixture.detectChanges();
    await fixture.whenStable();
    vi.unstubAllGlobals();

    expect(create).toHaveBeenCalledWith(expect.objectContaining({ message: STORAGE_WRITE_ERROR_MESSAGE }));
  });
});
