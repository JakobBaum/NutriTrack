// Polyfills for running unit tests under jsdom (the default Vitest environment).
// Ionic components such as ion-menu and ion-split-pane query `window.matchMedia`,
// which jsdom does not implement.
if (!window.matchMedia) {
  window.matchMedia = (query: string): MediaQueryList =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    }) as MediaQueryList;
}

// Unit-Tests duerfen nie den echten globalen KI-Worker erreichen: Standard-Server leeren.
// Tests, die den globalen Weg pruefen, setzen environment.aiProxyUrl selbst.
import { environment } from './environments/environment';
environment.aiProxyUrl = '';
