import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ToastController } from '@ionic/angular';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProfileStore } from '../core/state/profile.store';
import { WRITE_BLOCKED_MESSAGE } from '../core/storage/storage-messages';
import { WeightStore } from '../core/state/weight.store';
import { WeightCardComponent } from './weight-card.component';

describe('WeightCardComponent Hinweis "Ziel neu berechnen"', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      declarations: [WeightCardComponent],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
      providers: [{ provide: ToastController, useValue: { create: vi.fn() } }],
    });
    TestBed.overrideComponent(WeightCardComponent, { set: { template: '' } });
    TestBed.inject(ProfileStore).setProfile({
      weightKg: 90, heightCm: 180, age: 30, sex: 'male', activityLevel: 'moderate', goal: 'maintain', updatedAt: '',
    });
    TestBed.inject(WeightStore).set('2026-11-14', 85);
  });

  it('lässt den Hinweis stehen, wenn nur das Profil geöffnet wird (erst Speichern erledigt ihn)', () => {
    // Arrange
    const card = TestBed.createComponent(WeightCardComponent).componentInstance;
    const emitted = vi.fn();
    card.recalculate.subscribe(emitted);
    expect(card.driftText()).not.toBeNull();

    // Act
    card.recalc();

    // Assert
    expect(emitted).toHaveBeenCalledWith(85);
    expect(card.driftText()).not.toBeNull();
  });

  it('blendet den Hinweis aus, sobald das Profil das neue Gewicht hat', () => {
    const card = TestBed.createComponent(WeightCardComponent).componentInstance;
    TestBed.inject(ProfileStore).setProfile({
      weightKg: 85, heightCm: 180, age: 30, sex: 'male', activityLevel: 'moderate', goal: 'maintain', updatedAt: '',
    });
    expect(card.driftText()).toBeNull();
  });
});

describe('WeightCardComponent Löschen bei Schreibsperre', () => {
  const create = vi.fn();

  beforeEach(() => {
    create.mockReset().mockResolvedValue({ present: async () => undefined });
    localStorage.clear();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      declarations: [WeightCardComponent],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
      providers: [{ provide: ToastController, useValue: { create, getTop: async () => undefined } }],
    });
    TestBed.overrideComponent(WeightCardComponent, { set: { template: '' } });
    TestBed.inject(WeightStore).set('2026-11-14', 85);
  });

  it('löscht nichts und zeigt keine Erfolgsmeldung, wenn Schreiben gesperrt ist', async () => {
    const card = TestBed.createComponent(WeightCardComponent).componentInstance;
    window.dispatchEvent(new StorageEvent('storage', { key: 'nutritrack:diary', newValue: '[]', storageArea: localStorage }));

    card.remove('2026-11-14', 85);
    await vi.waitFor(() => expect(create).toHaveBeenCalled());

    expect(TestBed.inject(WeightStore).entries().length).toBe(1);
    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0][0].message).toBe(WRITE_BLOCKED_MESSAGE);
    expect(create.mock.calls[0][0].message).not.toContain('gelöscht');
  });

  it('zeigt keinen Rückgängig-Hinweis, wenn das Löschen scheitert', async () => {
    const card = TestBed.createComponent(WeightCardComponent).componentInstance;
    const store = TestBed.inject(WeightStore);
    vi.spyOn(store, 'remove').mockReturnValue(false);

    card.remove('2026-11-14', 85);
    await vi.waitFor(() => expect(create).toHaveBeenCalled());

    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0][0].message).toBe(WRITE_BLOCKED_MESSAGE);
    expect(create.mock.calls[0][0].buttons).toEqual([]);
  });

  it('Rückgängig stellt den Eintrag wieder her; bei Schreibsperre meldet es den Fehler statt Erfolg', async () => {
    const card = TestBed.createComponent(WeightCardComponent).componentInstance;
    const store = TestBed.inject(WeightStore);

    card.remove('2026-11-14', 85);
    await vi.waitFor(() => expect(create).toHaveBeenCalled());
    expect(store.entries()).toEqual([]);
    const undo = create.mock.calls[0][0].buttons[0].handler as () => void;

    window.dispatchEvent(new StorageEvent('storage', { key: 'nutritrack:diary', newValue: '[]', storageArea: localStorage }));
    undo();
    await vi.waitFor(() => expect(create).toHaveBeenCalledTimes(2));

    expect(store.entries()).toEqual([]);
    expect(create.mock.calls[1][0].message).toBe(WRITE_BLOCKED_MESSAGE);
  });

  it('Rückgängig bei freiem Speicher legt den Eintrag wieder an', async () => {
    const card = TestBed.createComponent(WeightCardComponent).componentInstance;
    const store = TestBed.inject(WeightStore);

    card.remove('2026-11-14', 85);
    await vi.waitFor(() => expect(create).toHaveBeenCalled());
    (create.mock.calls[0][0].buttons[0].handler as () => void)();

    expect(store.entries()).toEqual([{ dateISO: '2026-11-14', kg: 85 }]);
  });
});
