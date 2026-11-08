import { HttpErrorResponse } from '@angular/common/http';
import { describe, expect, it } from 'vitest';
import { ONLINE_SEARCH_MESSAGES, OnlineSearchError, failureForStatus, toOnlineSearchError } from './spoonacular.errors';

describe('failureForStatus', () => {
  it.each([
    [401, false, 'auth'],
    [403, false, 'auth'],
    [402, false, 'quota'],
    [429, false, 'rate-limit'],
    [0, true, 'offline'],
    [0, false, 'server'],
    [500, false, 'server'],
  ] as const)('maps status %i (offline=%s) to %s', (status, offline, expected) => {
    expect(failureForStatus(status, offline)).toBe(expected);
  });
});

describe('toOnlineSearchError', () => {
  it('returns a German message for a 402', () => {
    const err = toOnlineSearchError(new HttpErrorResponse({ status: 402 }), false);
    expect(err.reason).toBe('quota');
    expect(err.message).toBe(ONLINE_SEARCH_MESSAGES.quota);
  });

  it('keeps existing OnlineSearchErrors and wraps unknown errors as server', () => {
    const own = new OnlineSearchError('no-key', 'x');
    expect(toOnlineSearchError(own, false)).toBe(own);
    expect(toOnlineSearchError(new Error('boom'), false).reason).toBe('server');
  });
});
