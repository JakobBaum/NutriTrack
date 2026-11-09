const QUERY = '(prefers-reduced-motion: reduce)';

/** Liefert die Media-Query des Systems oder null (Tests, alte Umgebungen). */
export function reducedMotionQuery(): MediaQueryList | null {
  return typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(QUERY) : null;
}

/**
 * Ruft `apply(animated)` sofort und bei jeder Änderung des Systemwunsches „Bewegung reduzieren“ auf.
 * Liefert eine Funktion zum Abmelden.
 */
export function watchReducedMotion(
  getQuery: () => MediaQueryList | null,
  apply: (animated: boolean) => void,
): () => void {
  const query = getQuery();
  if (!query) return () => undefined;
  const update = (): void => apply(!query.matches);
  update();
  query.addEventListener('change', update);
  return () => query.removeEventListener('change', update);
}

interface IonicWindow {
  Ionic?: { config?: { set?: (key: string, value: unknown) => void } };
}

/** Schaltet die Ionic-Animationen (Modals, Seitenwechsel, Toasts) zur Laufzeit ein oder aus. */
export function setIonicAnimated(animated: boolean): void {
  const config = typeof window === 'undefined' ? undefined : (window as unknown as IonicWindow).Ionic?.config;
  config?.set?.('animated', animated);
}
