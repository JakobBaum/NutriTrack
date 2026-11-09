import { UrlTree } from '@angular/router';

/** True, wenn die URL die Profil-Einrichtung anfordert (`/settings?setup=1`). */
export function isSetupLink(tree: UrlTree): boolean {
  if (tree.queryParams['setup'] !== '1') return false;
  const segments = tree.root.children['primary']?.segments ?? [];
  return segments.some((s) => s.path === 'settings');
}
