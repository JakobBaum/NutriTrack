import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { AiService } from '../../core/ai/ai.service';
import { ConsentStore } from '../../core/consent/consent.store';
import { ProfileStore } from '../../core/state/profile.store';
import { ProfileSheetComponent } from './profile-sheet.component';

const BASE = { weightKg: 70, heightCm: 175, age: 30, sex: 'male', activityLevel: 'moderate', goal: 'maintain', updatedAt: '' } as const;

function setup(existing: boolean): { sheet: ProfileSheetComponent; store: ProfileStore } {
  localStorage.clear();
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    declarations: [ProfileSheetComponent],
    schemas: [CUSTOM_ELEMENTS_SCHEMA],
    providers: [provideHttpClient(), { provide: AiService, useValue: { translateSearchQuery: vi.fn(), isLive: () => true } }],
  });
  TestBed.overrideComponent(ProfileSheetComponent, { set: { template: '' } });
  TestBed.inject(ConsentStore).grant(new Date(), true);
  const store = TestBed.inject(ProfileStore);
  if (existing) store.setProfile({ ...BASE });
  const fixture = TestBed.createComponent(ProfileSheetComponent);
  fixture.componentRef.setInput('isOpen', true);
  fixture.detectChanges();
  return { sheet: fixture.componentInstance, store };
}

describe('ProfileSheetComponent Fastfood-Land', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('zeigt die Vorgabe Österreich und die bekannte Länderliste', () => {
    const { sheet } = setup(true);
    expect(sheet.form().fastfoodCountry).toBe('Österreich');
    expect(sheet.countries).toContain('Italien');
  });

  it('speichert das gewählte Land im Profil', async () => {
    const { sheet, store } = setup(true);
    sheet.setFastfoodCountry('Italien');
    await sheet.save();
    expect(store.profile()?.fastfoodCountry).toBe('Italien');
    expect(store.fastfoodCountry()).toBe('Italien');
  });

  it('speichert die Vorgabe ausdrücklich, damit ein altes Land sie nicht überschreibt', async () => {
    const { sheet, store } = setup(true);
    await sheet.save();
    expect(store.profile()?.fastfoodCountry).toBe('Österreich');
  });
});
