import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { ModalController } from '@ionic/angular/lazy';
import { ConsentService } from './consent.service';
import { ConsentStore } from './consent.store';
import { ProfileStore } from '../state/profile.store';

interface FakeModal {
  present: () => Promise<void>;
  onWillDismiss: () => Promise<{ role: string }>;
}

function setup(dialogResult: 'confirm' | 'cancel') {
  localStorage.clear();
  TestBed.resetTestingModule();
  let resolveDismiss: (v: { role: string }) => void = () => undefined;
  const dismissed = new Promise<{ role: string }>((r) => (resolveDismiss = r));
  const modal: FakeModal = { present: () => Promise.resolve(), onWillDismiss: () => dismissed };
  const create = vi.fn().mockResolvedValue(modal);
  TestBed.configureTestingModule({ providers: [{ provide: ModalController, useValue: { create } }] });
  const store = TestBed.inject(ConsentStore);
  const service = TestBed.inject(ConsentService);
  const finish = (): void => {
    if (dialogResult === 'confirm') store.grant(new Date(), true);
    resolveDismiss({ role: dialogResult });
  };
  return { service, store, create, finish };
}

beforeEach(() => localStorage.clear());

describe('ConsentService.ensure', () => {
  it('liefert sofort true und öffnet keinen Dialog, wenn zugestimmt ist', async () => {
    const { service, store, create } = setup('confirm');
    store.grant(new Date(), true);
    await expect(service.ensure()).resolves.toBe(true);
    expect(create).not.toHaveBeenCalled();
  });

  it('öffnet den Dialog und liefert true nach Zustimmung', async () => {
    const { service, create, finish } = setup('confirm');
    const result = service.ensure();
    finish();
    await expect(result).resolves.toBe(true);
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('liefert false bei "Nicht jetzt"', async () => {
    const { service, finish } = setup('cancel');
    const result = service.ensure();
    finish();
    await expect(result).resolves.toBe(false);
  });

  it('teilt sich bei gleichzeitigen Aufrufen einen Dialog', async () => {
    const { service, create, finish } = setup('confirm');
    const results = [service.ensure(), service.ensure(), service.ensure()];
    finish();
    await expect(Promise.all(results)).resolves.toEqual([true, true, true]);
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('fragt nach einem abgelehnten Dialog beim nächsten Aufruf erneut', async () => {
    const { service, create, finish } = setup('cancel');
    const first = service.ensure();
    finish();
    await first;
    const second = service.ensure();
    await Promise.resolve();
    expect(create).toHaveBeenCalledTimes(2);
    void second;
  });

  it('gibt false zurück, wenn der Dialog nicht geöffnet werden kann', async () => {
    const { service, create } = setup('cancel');
    create.mockRejectedValueOnce(new Error('kaputt'));
    await expect(service.ensure()).resolves.toBe(false);
  });

  it('meldet für Minderjährige, dass keine Zustimmung möglich ist', () => {
    const { service } = setup('cancel');
    TestBed.inject(ProfileStore).setProfile({
      weightKg: 60, heightCm: 170, age: 16, sex: 'female', activityLevel: 'moderate', goal: 'maintain', rateKgPerWeek: 0, updatedAt: '',
    });
    expect(service.isMinor()).toBe(true);
  });
});

describe('ConsentService.isGranted', () => {
  it('spiegelt den Speicher', () => {
    const { service, store } = setup('cancel');
    expect(service.isGranted()).toBe(false);
    store.grant(new Date(), true);
    expect(service.isGranted()).toBe(true);
  });
});
