import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { describe, expect, it } from 'vitest';
import { isSetupLink } from './setup-link';

describe('isSetupLink', () => {
  const tree = (url: string) => TestBed.inject(Router).parseUrl(url);

  it('erkennt /settings?setup=1', () => {
    expect(isSetupLink(tree('/settings?setup=1'))).toBe(true);
  });

  it('erkennt den Link auch mit weiteren Parametern', () => {
    expect(isSetupLink(tree('/settings?a=b&setup=1'))).toBe(true);
  });

  it('ignoriert andere Seiten, andere Werte und verbrauchte Links', () => {
    expect(isSetupLink(tree('/dashboard?setup=1'))).toBe(false);
    expect(isSetupLink(tree('/settings?setup=0'))).toBe(false);
    expect(isSetupLink(tree('/settings'))).toBe(false);
  });
});
