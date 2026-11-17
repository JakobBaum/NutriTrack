import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ModalController } from '@ionic/angular/lazy';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConsentStore } from '../../core/consent/consent.store';
import { EXTERNAL_CHANGE_MESSAGE } from '../../core/storage/storage-messages';
import { CONSENT_ROLE_CONFIRM, ConsentDialogComponent } from './consent-dialog.component';

function lockStorage(): void {
  window.dispatchEvent(new StorageEvent('storage', { key: 'nutritrack:diary', newValue: '[]', storageArea: localStorage }));
}

describe('ConsentDialogComponent Zustimmen', () => {
  const dismiss = vi.fn();

  beforeEach(() => {
    localStorage.clear();
    dismiss.mockReset();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      declarations: [ConsentDialogComponent],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
      providers: [{ provide: ModalController, useValue: { dismiss, create: vi.fn() } }],
    });
  });

  it('speichert die Zustimmung und schließt den Dialog ohne Fehlermeldung', () => {
    const fixture = TestBed.createComponent(ConsentDialogComponent);
    const dialog = fixture.componentInstance;
    dialog.setAdult(true);
    dialog.accept();
    expect(TestBed.inject(ConsentStore).granted()).toBe(true);
    expect(dismiss).toHaveBeenCalledWith(null, CONSENT_ROLE_CONFIRM);
    expect(dialog.acceptError()).toBeNull();
  });

  it('zeigt bei Schreibsperre eine Fehlermeldung mit role="alert" und bleibt offen', () => {
    const fixture = TestBed.createComponent(ConsentDialogComponent);
    const dialog = fixture.componentInstance;
    lockStorage();
    dialog.setAdult(true);
    dialog.accept();
    fixture.detectChanges();
    expect(dismiss).not.toHaveBeenCalled();
    expect(TestBed.inject(ConsentStore).granted()).toBe(false);
    expect(dialog.acceptError()).toBe(EXTERNAL_CHANGE_MESSAGE);
    const alert = (fixture.nativeElement as HTMLElement).querySelector('[data-testid="consent-accept-error"]');
    expect(alert?.getAttribute('role')).toBe('alert');
    expect(alert?.textContent).toContain(EXTERNAL_CHANGE_MESSAGE);
  });

  it('meldet nichts, solange die Volljährigkeit nicht bestätigt ist', () => {
    const dialog = TestBed.createComponent(ConsentDialogComponent).componentInstance;
    dialog.accept();
    expect(dialog.acceptError()).toBeNull();
    expect(dismiss).not.toHaveBeenCalled();
  });
});
