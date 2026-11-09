import { ParamMap, Router } from '@angular/router';

/**
 * Gemeinsame Regel für Deep Links (`?open=`, `?view=`, `?setup=`): Der Parameter wird einmal gelesen
 * und danach per `clearQueryParams` aus der URL entfernt. So öffnet sich nach Reload oder
 * Tab-Rückkehr nichts erneut, und derselbe Link wirkt beim nächsten Mal wieder.
 */

/** Wert des Parameters, wenn er in `allowed` steht, sonst null. */
export function pickParam<T extends string>(params: ParamMap | null | undefined, name: string, allowed: readonly T[]): T | null {
  const value = params?.get(name) ?? null;
  return allowed.includes(value as T) ? (value as T) : null;
}

/** Entfernt die Parameter aus der aktuellen URL (ohne neuen History-Eintrag). */
export function clearQueryParams(router: Pick<Router, 'navigate'>, names: readonly string[]): Promise<boolean> {
  const queryParams = Object.fromEntries(names.map((name) => [name, null]));
  return router.navigate([], { queryParams, queryParamsHandling: 'merge', replaceUrl: true });
}
