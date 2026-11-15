import { HttpHandlerFn, HttpRequest, HttpResponse } from '@angular/common/http';
import { Capacitor } from '@capacitor/core';
import { of } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { environment } from '../../../environments/environment';
import { nativeClientInterceptor } from './native-client.interceptor';

function run(url: string): HttpRequest<unknown> {
  let seen!: HttpRequest<unknown>;
  const next: HttpHandlerFn = (req) => {
    seen = req;
    return of(new HttpResponse());
  };
  nativeClientInterceptor(new HttpRequest('GET', url), next).subscribe();
  return seen;
}

afterEach(() => {
  environment.aiProxyUrl = '';
  vi.restoreAllMocks();
});

describe('nativeClientInterceptor', () => {
  it('setzt den Header nativ für den Worker', () => {
    environment.aiProxyUrl = 'https://w.test';
    vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true);
    expect(run('https://w.test/off-search').headers.get('X-NutriTrack-Client')).toBe('ios');
  });

  it('lässt fremde Adressen nativ unverändert', () => {
    environment.aiProxyUrl = 'https://w.test';
    vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true);
    expect(run('https://other.test/x').headers.has('X-NutriTrack-Client')).toBe(false);
  });

  it('setzt im Browser nie einen Header', () => {
    environment.aiProxyUrl = 'https://w.test';
    vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(false);
    expect(run('https://w.test/').headers.has('X-NutriTrack-Client')).toBe(false);
  });
});
