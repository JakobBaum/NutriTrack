/** Erzeugt eine kollisionsarme ID (für lokale Entitäten, kein Krypto-Zweck). */
export function makeId(prefix = 'id'): string {
  const rnd = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now().toString(36)}_${rnd}`;
}
