import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { AppComponent } from './app.component';
import { StoragePersistenceService } from './core/storage/storage-persistence.service';
import { vi } from 'vitest';

describe('AppComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [AppComponent],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('enthält die dauerhafte Statusleiste für Speicherfehler', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-status-banner')).not.toBeNull();
  });

  it('löscht beim Start einen alten Rezeptsuche-Eintrag mit eigenem Key', () => {
    localStorage.setItem('nutritrack:recipe-search-config', JSON.stringify({ apiKey: 'geheim' }));
    TestBed.createComponent(AppComponent);
    expect(localStorage.getItem('nutritrack:recipe-search-config')).toBeNull();
  });

  it('bittet beim Start um dauerhaften Speicher', () => {
    const request = vi.spyOn(TestBed.inject(StoragePersistenceService), 'request').mockResolvedValue(true);
    TestBed.createComponent(AppComponent);
    expect(request).toHaveBeenCalledTimes(1);
  });
});
