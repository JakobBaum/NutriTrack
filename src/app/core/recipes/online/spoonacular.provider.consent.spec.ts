import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { SpoonacularProvider } from './spoonacular.provider';
import { EMPTY_FILTERS } from './spoonacular.query';
import { ConsentService } from '../../consent/consent.service';
import { ONLINE_SEARCH_MESSAGES } from './spoonacular.errors';
import { environment } from '../../../../environments/environment';

const WORKER = 'https://nutritrack.example.workers.dev';

let http: HttpTestingController;
const ensure = vi.fn<() => Promise<boolean>>();

function setup(): SpoonacularProvider {
  localStorage.clear();
  environment.aiProxyUrl = WORKER;
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [provideHttpClient(), provideHttpClientTesting(), { provide: ConsentService, useValue: { ensure, isGranted: () => false } }],
  });
  http = TestBed.inject(HttpTestingController);
  return TestBed.inject(SpoonacularProvider);
}

beforeEach(() => ensure.mockReset());
afterEach(() => {
  http.verify();
  environment.aiProxyUrl = '';
});

describe('SpoonacularProvider ohne Zustimmung', () => {
  it('sendet keine Anfrage und meldet den Zustimmungs-Fehler, wenn der Dialog abgelehnt wird', async () => {
    const provider = setup();
    ensure.mockResolvedValue(false);
    await expect(provider.search(EMPTY_FILTERS)).rejects.toMatchObject({
      reason: 'consent',
      message: ONLINE_SEARCH_MESSAGES.consent,
    });
    http.expectNone(() => true);
  });

  it('sendet die Anfrage erst nach der Zustimmung', async () => {
    const provider = setup();
    ensure.mockResolvedValue(true);
    const promise = provider.search(EMPTY_FILTERS);
    await vi.waitFor(() => http.expectOne((r) => r.url === `${WORKER}/recipes/complexSearch`).flush({ results: [], totalResults: 0 }));
    await expect(promise).resolves.toMatchObject({ totalResults: 0 });
    expect(ensure).toHaveBeenCalledTimes(1);
  });
});
