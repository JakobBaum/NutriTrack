// Design-Tokens aus der laufenden App lesen (Basis- bzw. Kompaktwerte), statt feste Zahlen zu pruefen.
// Feste Untergrenzen als Sicherheitsnetz, falls ein Token versehentlich zu klein wird.
export const MIN_BUTTON_PX = 36; // Buttons / Tippflaechen (kompakt: --nt-touch / --nt-btn-height 36)
export const MIN_FONT_PX = 12; // = --nt-fs-caption
export const MIN_FAB_PX = 44;
export const ICON_BUTTON_PX = 44; // Symbol-Buttons bleiben 44 (--nt-icon-btn)

/** Liest ein Laengen-Token (px oder rem, z. B. '--nt-btn-height') als aufgeloeste px-Zahl; Fallback, falls nicht gesetzt. */
export const tokenPx = (page, name, fallback = 0) =>
  page.evaluate(([n, fb]) => {
    const probe = document.createElement('div');
    probe.style.cssText = `position:absolute;visibility:hidden;width:var(${n}, 0px)`;
    document.documentElement.appendChild(probe);
    const px = probe.getBoundingClientRect().width;
    probe.remove();
    return px || fb;
  }, [name, fallback]);
