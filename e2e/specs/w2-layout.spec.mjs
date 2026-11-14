// Welle 2, Phase 1: Layout und Einheitlichkeit. Eine Messung je Route und Viewport (gecacht), ein Test je Route und Regel,
// damit Phase 2 (Tagebuch, Rezepte, Mahlzeiten, Einkauf) gezielt einzelne Regeln gruen machen kann.
import { assert, go, settle } from '../lib/harness.mjs';
import { ionInput, topModal } from '../lib/ionic.mjs';
import { DIARY_NORMAL, WEIGHT_HISTORY, seed } from '../lib/fixtures.mjs';

const VIEWPORTS = [{ width: 375, height: 667 }, { width: 320, height: 568 }];
const ROUTES = [
  { id: 'dashboard', url: 'dashboard', fab: true, stat: true },
  { id: 'diary', url: 'diary', fab: true, stat: true },
  { id: 'recipes', url: 'recipes', fab: true },
  { id: 'meals', url: 'recipes?view=meals', fab: true },
  { id: 'shopping-list', url: 'shopping?view=list', fab: true },
  { id: 'shopping-plan', url: 'shopping?view=plan' },
  { id: 'settings', url: 'settings' },
];
const REFERENCE_ROUTE = ROUTES[0];
const TOL_PX = 1;
const RADIUS_TOL_PX = 2;
const MIN_INNER_RADIUS_PX = 8;
const BUTTON_HEIGHT_PX = 44;
const ICON_BUTTON_PX = 44;
const FAB_PX = 56;
const FAB_END_PX = 16;
const FAB_TO_TABBAR_PX = 16;
const SECTION_FONT_PX = 13;
const SETTLE_MS = 500;
/** Speichern steht hoechstens so weit ueber der Sheet-Unterkante (Abstand 12 + Safe Area). */
const SHEET_FOOTER_BOTTOM_MAX_PX = 24;
const CLOSE_END_MAX_PX = 24;
/** Innerste aktive Seite (nicht der Tabs-Rahmen, der die Tab-Bar und versteckte Seiten enthaelt). */
const ACTIVE_PAGE = 'ion-tabs ion-router-outlet > .ion-page:not(.ion-page-hidden)';
const STAMP = new Date().toISOString();

const RECIPE = {
  id: 'r-a', title: 'Spaghetti Aglio e Olio', servings: 2,
  ingredients: [{ id: 'i1', name: 'Spaghetti', amount: 200, unit: 'g' }], steps: ['Kochen'], origin: 'manual', createdAt: STAMP, updatedAt: STAMP,
};
const MEAL = {
  id: 'm-1', name: 'Frühstück Standard', createdAt: STAMP,
  entries: [{ label: 'Haferflocken', facts: { kcal: 370, proteinG: 13, carbsG: 59, fatG: 7, basis: 'perPortion' }, ref: { kind: 'manual' } }],
};
const LIST = {
  id: 's1', dishes: 2, persons: 2, generatedAt: STAMP, days: 3, store: 'Spar',
  items: [
    { name: 'Rote Linsen', amount: 400, unit: 'g', checked: false, estPrice: 2.3 },
    { name: 'Zwiebeln', amount: 3, unit: 'Stk', checked: true, estPrice: 0.9 },
  ],
};
const PLAN = {
  id: 'wp1', generatedAt: STAMP, persons: 2, days: 3, meals: ['lunch'], notices: [],
  recipes: ['Linsen-Dal', 'Quinoa-Bowl'].map((title, i) => ({
    id: `p${i}`, title, servings: 2, meal: 'lunch', portions: 2, steps: ['Kochen'],
    ingredients: [{ id: 'x', name: 'Linsen', amount: 200, unit: 'g' }],
    facts: { kcal: 450, proteinG: 38, carbsG: 40, fatG: 12, basis: 'perPortion' },
  })),
};
const SEED = () => seed({ diary: DIARY_NORMAL, weight: WEIGHT_HISTORY, recipes: [RECIPE], savedMeals: [MEAL], shopping: LIST, 'week-plan': PLAN });

/** Laeuft im Browser: misst die aktive Seite. Reine Lesefunktion, keine Aenderung am DOM. */
function measureInPage({ tol, minR, rtol, activeSel }) {
  const vw = window.innerWidth;
  const page = document.querySelector(activeSel);
  const num = (v) => Number.parseFloat(v) || 0;
  const rect = (el) => { const r = el.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height }; };
  const isVisible = (el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none'; };
  const nativeOf = (el) => (el.tagName === 'ION-BUTTON' ? el.shadowRoot?.querySelector('.button-native') ?? el : el);
  const radiusOf = (el) => {
    const cs = getComputedStyle(nativeOf(el));
    const raw = cs.borderTopLeftRadius;
    const r = el.getBoundingClientRect();
    const value = raw.endsWith('%') ? (num(raw) / 100) * r.width : num(raw);
    return Math.min(value, r.width / 2, r.height / 2);
  };
  const all = [...page.querySelectorAll('*')].filter(isVisible);

  // Karten: weisse Flaeche, Radius >= 16, nicht in einer anderen Karte.
  const isCard = (el) => {
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return cs.backgroundColor === 'rgb(255, 255, 255)' && radiusOf(el) >= 16 && r.width >= 60 && r.height >= 30 && !el.matches('ion-fab, ion-fab-button, ion-tab-bar');
  };
  const cardEls = all.filter(isCard);
  const topCards = cardEls.filter((el) => !cardEls.some((o) => o !== el && o.contains(el)));
  const cards = topCards.map((el) => ({ cls: `${el.tagName.toLowerCase()}.${String(el.className).trim().split(/\s+/).join('.')}`, ...rect(el), rightGap: vw - el.getBoundingClientRect().right, radius: radiusOf(el) }));

  // Seitentitel und Kopf
  const header = page.querySelector('.nt-page-header');
  const title = header?.querySelector('.nt-large-title');
  const headerData = header && title ? { title: rect(title), box: rect(header), fontSize: num(getComputedStyle(title).fontSize) } : null;
  const headerButtons = header ? [...header.querySelectorAll('button, ion-button')].filter(isVisible).map((b) => ({
    text: b.textContent.trim(), label: (b.getAttribute('aria-label') ?? b.shadowRoot?.querySelector('button')?.getAttribute('aria-label') ?? ''), ...rect(b),
  })) : [];

  // Kopf -> erster Inhalt
  const blockSel = 'ion-segment, nt-date-nav, .nt-card, .nt-grouped, .nt-section-header, ion-card, .nt-stat';
  const headerBottom = header ? header.getBoundingClientRect().bottom : null;
  const firstTops = headerBottom === null ? [] : [...page.querySelectorAll(blockSel)].filter(isVisible).map((el) => el.getBoundingClientRect().top).filter((t) => t >= headerBottom - tol);
  const firstGap = firstTops.length ? Math.min(...firstTops) - headerBottom : null;

  // Ueberlauf
  const SKIP = 'ion-toast, ion-modal, ion-alert, ion-loading, ion-action-sheet, ion-popover, ion-backdrop, .visually-hidden, .backup-input, input[type=file]';
  const clippedByAncestor = (el) => {
    for (let p = el.parentElement; p && p !== page; p = p.parentElement) {
      const cs = getComputedStyle(p);
      if (cs.overflowX !== 'visible' && p.getBoundingClientRect().right <= vw + 0.5 && p.getBoundingClientRect().left >= -0.5) return true;
    }
    return false;
  };
  const overflow = all.filter((el) => !el.matches(SKIP) && !el.closest(SKIP)).filter((el) => {
    const r = el.getBoundingClientRect();
    return (r.right > vw + 0.5 || r.left < -0.5) && !clippedByAncestor(el);
  }).slice(0, 8).map((el) => `${el.tagName.toLowerCase()}.${String(el.className).trim().split(/\s+/).join('.')} [${Math.round(el.getBoundingClientRect().left)}..${Math.round(el.getBoundingClientRect().right)}]`);
  const content = page.querySelector('ion-content');
  const inner = content?.shadowRoot?.querySelector('.inner-scroll');
  const scrollOverflow = Math.max(document.documentElement.scrollWidth - vw, inner ? inner.scrollWidth - inner.clientWidth : 0);

  // Verschachtelte Radien: sichtbare Flaeche (Fuellung oder Rand) mit Radius in einer Karte
  const hasBox = (el) => {
    const cs = getComputedStyle(nativeOf(el));
    const bg = cs.backgroundColor;
    const alpha = bg.startsWith('rgba') ? num(bg.split(',')[3]) : bg === 'transparent' ? 0 : 1;
    return alpha > 0.05 || (num(cs.borderTopWidth) > 0 && cs.borderTopColor !== 'rgba(0, 0, 0, 0)');
  };
  const radiusIssues = [];
  for (const el of all) {
    const r = radiusOf(el);
    if (r <= 0 || !hasBox(el) || cardEls.includes(el) || el.matches('ion-fab-button, ion-fab')) continue;
    const outer = cardEls.filter((c) => c !== el && c.contains(el)).pop();
    if (!outer) continue;
    const o = outer.getBoundingClientRect();
    const e = el.getBoundingClientRect();
    const outerR = radiusOf(outer);
    const corners = [[e.left - o.left, e.top - o.top], [o.right - e.right, e.top - o.top], [e.left - o.left, o.bottom - e.bottom], [o.right - e.right, o.bottom - e.bottom]];
    for (const [gx, gy] of corners) {
      if (gx >= outerR + 6 || gy >= outerR + 6) continue;
      const allowed = Math.max(minR, outerR - Math.min(gx, gy)) + rtol;
      if (r > allowed) {
        radiusIssues.push(`${el.tagName.toLowerCase()}.${String(el.className).trim().split(/\s+/).join('.')} r${r.toFixed(1)} in r${outerR} Abstand ${Math.round(gx)}/${Math.round(gy)} (erlaubt ${allowed.toFixed(1)})`);
        break;
      }
    }
  }

  // Abschnittsueberschriften
  const sectionHeaders = [...page.querySelectorAll('.nt-section-header')].filter(isVisible).map((el) => {
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    const next = topCards.map((c) => c.getBoundingClientRect()).filter((c) => c.top >= r.bottom - 1).sort((a, b) => a.top - b.top)[0];
    return {
      style: [cs.fontSize, cs.fontWeight, cs.color, cs.textTransform, cs.letterSpacing].join('|'),
      fontSize: num(cs.fontSize), uppercase: cs.textTransform === 'uppercase',
      indent: next ? r.left + num(cs.paddingLeft) - next.left : null,
    };
  });
  const strayHeadings = [...page.querySelectorAll('h2, h3')].filter((el) => isVisible(el) && !el.classList.contains('nt-section-header')
    && !el.closest('.nt-card, .nt-grouped, ion-card, ion-item, ion-label, .nt-page-header, .empty, [class*="empty"], .recipe, article, .meal')).map((el) => `${el.tagName.toLowerCase()}.${el.className}: ${el.textContent.trim().slice(0, 30)}`);

  // Buttons der Rollen primaer/getoent
  const NOT_BUTTON = 'ion-segment-button, ion-tab-button, ion-chip, ion-fab-button, .nt-chip, .rate-chip, .nt-source-btn, .minibar, .nt-card, [class*="card"], [class*="chip"]';
  const solidButtons = all.filter((el) => {
    if (el.matches(NOT_BUTTON) || el.closest(NOT_BUTTON)) return false;
    if (el.tagName === 'ION-BUTTON') {
      const fill = el.getAttribute('fill');
      return fill !== 'clear' && fill !== 'outline' && el.textContent.trim() !== '' && !el.closest('ion-buttons');
    }
    if (el.tagName === 'BUTTON') {
      const bg = getComputedStyle(el).backgroundColor;
      const alpha = bg.startsWith('rgba') ? num(bg.split(',')[3]) : bg === 'transparent' ? 0 : 1;
      return alpha > 0.5 && el.textContent.trim() !== '' && !el.closest('ion-segment, ion-tab-bar, .strip, ion-datetime');
    }
    return false;
  }).map((el) => ({ text: el.textContent.trim().slice(0, 30), height: el.getBoundingClientRect().height, width: el.getBoundingClientRect().width, tag: el.tagName.toLowerCase() }));
  const buttonTexts = all.filter((el) => el.matches('button, ion-button')).map((el) => el.textContent.trim());

  // Zahl + Einheit
  const stats = [...page.querySelectorAll('.nt-stat')].filter(isVisible).map((el) => {
    const n = el.querySelector('.nt-stat__num');
    const u = el.querySelector('.nt-stat__unit');
    const x = el.querySelector('.nt-stat__extra');
    const v = el.querySelector('.nt-stat__value');
    return { num: n && rect(n), unit: u && rect(u), extra: x && isVisible(x) ? rect(x) : null, value: v && rect(v) };
  });

  // FAB
  const fab = page.querySelector('ion-fab.nt-fab');
  const fabBtn = fab?.querySelector('ion-fab-button');
  const tabBar = document.querySelector('ion-tab-bar');
  const fabData = fabBtn ? { ...rect(fabBtn), label: (fabBtn.shadowRoot?.querySelector('[aria-label]')?.getAttribute('aria-label') ?? ''), rightGap: vw - fabBtn.getBoundingClientRect().right, count: page.querySelectorAll('ion-fab.nt-fab').length, tabTop: tabBar ? tabBar.getBoundingClientRect().top : null } : null;

  const gutter = num(getComputedStyle(document.documentElement).getPropertyValue('--nt-page-gutter'));
  return { vw, gutter, cards, headerData, headerButtons, firstGap, overflow, scrollOverflow, radiusIssues, sectionHeaders, strayHeadings, solidButtons, buttonTexts, stats, fabData };
}

/** Scrollt ans Ende und liefert die unterste Inhaltskante gegen die Oberkante des FAB. */
async function measureFabClearance(page) {
  return page.evaluate(async (activeSel) => {
    const pageEl = document.querySelector(activeSel);
    const content = pageEl.querySelector('ion-content');
    await content.scrollToBottom(0);
    await new Promise((r) => setTimeout(r, 300));
    const fab = pageEl.querySelector('ion-fab.nt-fab ion-fab-button');
    const skip = 'ion-fab, ion-toast, ion-modal, ion-backdrop';
    let maxBottom = 0;
    for (const el of content.querySelectorAll('*')) {
      if (el.matches(skip) || el.closest(skip)) continue;
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0 || cs.visibility === 'hidden' || cs.display === 'none' || cs.position === 'fixed') continue;
      maxBottom = Math.max(maxBottom, r.bottom);
    }
    return { maxBottom, fabTop: fab ? fab.getBoundingClientRect().top : null };
  }, ACTIVE_PAGE);
}

const cache = new Map();
/** Navigiert (falls noetig) und misst Route x Viewport genau einmal. */
async function measureRoute(page, vp, route) {
  const key = `${route.id}|${vp.width}`;
  if (!cache.has(key)) {
    await page.setViewportSize(vp);
    await go(page, route.url);
    await settle(page, SETTLE_MS);
    const data = await page.evaluate(measureInPage, { tol: TOL_PX, minR: MIN_INNER_RADIUS_PX, rtol: RADIUS_TOL_PX, activeSel: ACTIVE_PAGE });
    const clearance = route.fab ? await measureFabClearance(page) : null;
    cache.set(key, { ...data, clearance });
  }
  return cache.get(key);
}

const describe = (items) => items.join('; ');
const spread = (values) => (values.length ? Math.max(...values) - Math.min(...values) : 0);

const RULES = {
  'Karten: gleicher linker und rechter Abstand zum Viewport': (m) => {
    assert.ok(m.cards.length > 0, 'keine Karte gefunden');
    const lefts = m.cards.map((c) => c.left);
    const rights = m.cards.map((c) => c.rightGap);
    const detail = describe(m.cards.map((c) => `${c.cls} ${c.left.toFixed(1)}/${c.rightGap.toFixed(1)}`));
    assert.ok(spread(lefts) <= TOL_PX, `links uneinheitlich: ${detail}`);
    assert.ok(spread(rights) <= TOL_PX, `rechts uneinheitlich: ${detail}`);
    assert.ok(Math.abs(lefts[0] - rights[0]) <= TOL_PX, `links ${lefts[0]} != rechts ${rights[0]}: ${detail}`);
    assert.ok(Math.abs(lefts[0] - m.gutter) <= TOL_PX, `Rand ${lefts[0]} != --nt-page-gutter ${m.gutter}: ${detail}`);
  },
  'kein horizontaler Ueberlauf, nichts ragt aus dem Viewport': (m) => {
    assert.equal(m.overflow.length, 0, `ragt heraus: ${describe(m.overflow)}`);
    assert.ok(m.scrollOverflow <= 0.5, `horizontaler Scrollbereich ${m.scrollOverflow}px`);
  },
  'Radien: Innen <= Aussen - Abstand (min. 8)': (m) => {
    assert.equal(m.radiusIssues.length, 0, describe(m.radiusIssues));
  },
  'Abschnittsueberschriften: gleicher Stil und Einzug': (m) => {
    assert.deepEqual(m.strayHeadings, [], `Ueberschrift ohne .nt-section-header: ${describe(m.strayHeadings)}`);
    if (m.sectionHeaders.length === 0) return;
    assert.equal(new Set(m.sectionHeaders.map((h) => h.style)).size, 1, `Stile: ${describe([...new Set(m.sectionHeaders.map((h) => h.style))])}`);
    for (const h of m.sectionHeaders) assert.ok(Math.abs(h.fontSize - SECTION_FONT_PX) <= 0.1 && h.uppercase, `Schrift ${h.fontSize}px, Grossbuchstaben ${h.uppercase}`);
    const indents = m.sectionHeaders.map((h) => h.indent).filter((v) => v !== null);
    assert.ok(spread(indents) <= TOL_PX, `Einzug uneinheitlich: ${indents.join(', ')}`);
  },
  'Buttons primaer/getoent: Hoehe 44': (m) => {
    const bad = m.solidButtons.filter((b) => Math.abs(b.height - BUTTON_HEIGHT_PX) > 0.6);
    assert.equal(bad.length, 0, describe(bad.map((b) => `${b.tag} "${b.text}" ${b.height.toFixed(1)}px`)));
  },
  'Kopf: nur Symbol-Buttons 44x44 mit aria-label': (m) => {
    for (const b of m.headerButtons) {
      assert.equal(b.text, '', `Text-Button im Kopf: "${b.text}"`);
      assert.ok(b.label !== '', 'Symbol-Button ohne aria-label');
      assert.ok(b.width >= ICON_BUTTON_PX - 0.5 && b.height >= ICON_BUTTON_PX - 0.5, `Tippflaeche ${b.width}x${b.height}`);
    }
  },
  'Kopf -> erster Inhalt: einheitlicher Abstand': (m) => {
    assert.ok(m.headerData, 'kein .nt-page-header');
    assert.ok(m.firstGap !== null, 'kein Inhalt unter dem Kopf');
    assert.ok(Math.abs(m.firstGap) <= TOL_PX, `Inhalt beginnt ${m.firstGap.toFixed(1)}px nach dem Kopf (Abstand gehoert in den Kopf)`);
  },
};

const NO_LIST_BUTTON = /einkaufsliste (ö|oe)ffnen/i;

export function register({ test }) {
  for (const vp of VIEWPORTS) {
    const at = `${vp.width}x${vp.height}`;
    for (const route of ROUTES) {
      const run = (rule) => async (page) => rule(await measureRoute(page, vp, route));
      for (const [name, rule] of Object.entries(RULES)) test(`w2 ${route.id}: ${name} (${at})`, SEED(), run(rule));

      test(`w2 ${route.id}: Seitentitel gleiches x/y und gleiche Kopfhoehe (${at})`, SEED(), async (page) => {
        const m = await measureRoute(page, vp, route);
        assert.ok(m.headerData, 'kein .nt-page-header mit Titel');
        const ref = (await measureRoute(page, vp, REFERENCE_ROUTE)).headerData;
        assert.ok(ref, 'Referenz (Heute) hat keinen .nt-page-header');
        const t = m.headerData;
        assert.ok(Math.abs(t.title.left - m.gutter) <= TOL_PX, `Titel x ${t.title.left} != --nt-page-gutter ${m.gutter}`);
        assert.ok(Math.abs(t.title.left - ref.title.left) <= TOL_PX, `Titel x ${t.title.left} != Heute ${ref.title.left}`);
        assert.ok(Math.abs(t.title.top - ref.title.top) <= TOL_PX, `Titel y ${t.title.top} != Heute ${ref.title.top}`);
        assert.ok(Math.abs(t.box.height - ref.box.height) <= TOL_PX, `Kopfhoehe ${t.box.height} != Heute ${ref.box.height}`);
        assert.ok(Math.abs(t.fontSize - ref.fontSize) <= 0.1, `Titelschrift ${t.fontSize} != ${ref.fontSize}`);
      });

      if (route.fab) {
        test(`w2 ${route.id}: FAB mit aria-label, 56 px, ueber der Tab-Bar, Inhalt frei (${at})`, SEED(), async (page) => {
          const m = await measureRoute(page, vp, route);
          assert.ok(m.fabData, 'kein ion-fab.nt-fab');
          const f = m.fabData;
          assert.equal(f.count, 1, `${f.count} FABs`);
          assert.ok(f.label.trim() !== '', 'FAB ohne aria-label');
          assert.ok(Math.abs(f.width - FAB_PX) <= TOL_PX && Math.abs(f.height - FAB_PX) <= TOL_PX, `FAB ${f.width}x${f.height}`);
          assert.ok(Math.abs(f.rightGap - FAB_END_PX) <= TOL_PX, `FAB rechts ${f.rightGap}`);
          assert.ok(f.tabTop !== null && Math.abs(f.tabTop - f.bottom - FAB_TO_TABBAR_PX) <= TOL_PX, `FAB-Unterkante ${f.bottom}, Tab-Bar-Oberkante ${f.tabTop}`);
          assert.ok(m.clearance.fabTop !== null && m.clearance.maxBottom <= m.clearance.fabTop + TOL_PX, `letzte Zeile ${m.clearance.maxBottom} unter FAB-Oberkante ${m.clearance.fabTop}`);
          const textPills = m.headerButtons.filter((b) => b.text !== '');
          assert.equal(textPills.length, 0, `Text-Pille im Kopf: ${textPills.map((b) => b.text).join(', ')}`);
        });
      }

      if (route.stat) {
        test(`w2 ${route.id}: Zahl und Einheit in einer Zeile (${at})`, SEED(), async (page) => {
          const m = await measureRoute(page, vp, route);
          assert.ok(m.stats.length >= 2, `${m.stats.length} .nt-stat gefunden, erwartet >= 2`);
          for (const s of m.stats) {
            assert.ok(s.num && s.value, '.nt-stat ohne __num/__value');
            if (s.unit) assert.ok(s.unit.top < s.num.bottom - 2 && s.unit.left >= s.num.right - 2, 'Einheit steht nicht neben der Zahl');
            assert.ok(s.value.height <= s.num.height + 2, `Zahl und Einheit umbrechen (Zeile ${s.value.height}px)`);
            if (s.extra) assert.ok(s.extra.top >= s.value.bottom - TOL_PX, 'Zusatz steht nicht unter der Zeile');
          }
        });
      }

      if (route.id.startsWith('shopping')) {
        test(`w2 ${route.id}: kein Button "Einkaufsliste oeffnen" (${at})`, SEED(), async (page) => {
          const m = await measureRoute(page, vp, route);
          const hits = m.buttonTexts.filter((t) => NO_LIST_BUTTON.test(t));
          assert.equal(hits.length, 0, `Button vorhanden: ${hits.join(' | ')}`);
        });
      }
    }

    test(`w2 bausteine: .nt-btn Rollen sind 44 px hoch, Text-Button 16/600 (${at})`, SEED(), async (page) => {
      await page.setViewportSize(vp);
      await go(page, 'settings');
      const m = await page.evaluate((activeSel) => {
        const host = document.createElement('div');
        host.innerHTML = '<button class="nt-btn">A</button><button class="nt-btn nt-btn--tonal">B</button><button class="nt-btn nt-btn--text">C</button>'
          + '<ion-button class="nt-btn">D</ion-button><ion-button class="nt-btn nt-btn--tonal">E</ion-button><ion-button class="nt-btn nt-btn--text">F</ion-button>';
        document.querySelector('ion-router-outlet .ion-page:not(.ion-page-hidden) ion-content').appendChild(host);
        const out = [...host.children].map((el) => {
          const cs = getComputedStyle(el);
          return { tag: el.tagName.toLowerCase(), cls: el.className, height: el.getBoundingClientRect().height, size: cs.fontSize, weight: cs.fontWeight };
        });
        host.remove();
        return out;
      }, ACTIVE_PAGE);
      for (const b of m) assert.ok(Math.abs(b.height - BUTTON_HEIGHT_PX) <= 0.6, `${b.tag}.${b.cls} ${b.height}px`);
      const sizes = new Set(m.map((b) => `${b.size}|${b.weight}`));
      assert.equal(sizes.size, 1, `Schrift je Rolle uneinheitlich: ${[...sizes].join(', ')}`);
    });

    const SHEET_FOOTER_BTN = '.nt-sheet-footer .nt-btn';
    const sheetCases = [
      ['Gewicht', 'settings', (p) => p.locator('[data-testid="weight-add"]').click(), '[data-testid="weight-save"]'],
      ['Profil', 'settings', (p) => p.locator('[data-testid="open-profile"]').click(), '[data-testid="profile-save"]'],
      ['Eintragen', 'diary', async (p) => {
        await p.locator('[data-testid="diary-add"]').click();
        const m = topModal(p);
        await m.locator('.nt-source-btn', { hasText: 'Manuell' }).click();
        await ionInput(m, 'Name').waitFor();
      }, '.add-footer__save'],
      ['Bearbeiten', 'diary', (p) => p.locator('ion-item[button]').first().click(), '[data-testid="edit-save"]'],
      ['Rezept', 'recipes', (p) => p.getByRole('button', { name: 'Neues Rezept' }).click(), SHEET_FOOTER_BTN],
      ['Mahlzeit', 'recipes', async (p) => {
        await p.locator('ion-segment-button', { hasText: 'Mahlzeiten' }).click();
        await settle(p, 400);
        await p.getByRole('button', { name: 'Neue Mahlzeit' }).click();
      }, SHEET_FOOTER_BTN],
    ];
    for (const [name, route, open, saveSel] of sheetCases) {
      test(`w2 sheet ${name}: X rechts, Speichern unten in voller Breite, Radien (${at})`, SEED(), async (page) => {
        await page.setViewportSize(vp);
        await go(page, route);
        await open(page);
        const modal = topModal(page);
        await modal.locator(saveSel).waitFor();
        await settle(page, 900);
        const m = await modal.evaluate((el, sel) => {
          const q = (s) => el.querySelector(s)?.getBoundingClientRect() ?? null;
          const header = q('.nt-sheet-header');
          return { vw: window.innerWidth, vh: window.innerHeight, close: q('ion-button.nt-sheet-close'), title: q('.nt-sheet-header__title'), save: q(sel), header, gutter: Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--nt-page-gutter')) };
        }, saveSel);
        assert.ok(m.close && m.title && m.save, 'X, Titel oder Speichern fehlt');
        assert.ok(m.close.left > m.title.left + m.title.width / 2 || m.close.left >= m.vw / 2, `X nicht rechts (x ${m.close.left})`);
        assert.ok(Math.abs(m.close.width - ICON_BUTTON_PX) <= 0.6 && Math.abs(m.close.height - ICON_BUTTON_PX) <= 0.6, `X ${m.close.width}x${m.close.height}`);
        assert.ok(Math.abs(m.save.width - (m.vw - 2 * m.gutter)) <= 2, `Speichern ${m.save.width}px statt volle Breite ${m.vw - 2 * m.gutter}`);
        assert.ok(Math.abs(m.save.height - BUTTON_HEIGHT_PX) <= 0.6, `Speichern ${m.save.height}px hoch`);
        assert.ok(m.save.top > m.header.bottom && m.save.bottom <= m.vh + 0.5, `Speichern nicht unten sichtbar (${m.save.top}..${m.save.bottom} von ${m.vh})`);
        const radii = await page.evaluate(measureInPage, { tol: TOL_PX, minR: MIN_INNER_RADIUS_PX, rtol: RADIUS_TOL_PX, activeSel: 'ion-modal.show-modal' });
        assert.equal(radii.radiusIssues.length, 0, describe(radii.radiusIssues));
      });
    }

    test(`w2 sheet Gewicht: kurzer Inhalt, Speichern sitzt am unteren Rand ohne Spalt (${at})`, SEED(), async (page) => {
      await page.setViewportSize(vp);
      await go(page, 'settings');
      await page.locator('[data-testid="weight-add"]').click();
      const modal = topModal(page);
      await modal.locator('[data-testid="weight-save"]').waitFor();
      await settle(page, 900);
      const m = await modal.evaluate((el) => {
        const save = el.querySelector('[data-testid="weight-save"]').getBoundingClientRect();
        const wrapper = el.shadowRoot.querySelector('.modal-wrapper').getBoundingClientRect();
        return { bottom: save.bottom, wrapperBottom: wrapper.bottom };
      });
      assert.ok(m.wrapperBottom - m.bottom <= SHEET_FOOTER_BOTTOM_MAX_PX, `Abstand Speichern -> Sheet-Unterkante ${(m.wrapperBottom - m.bottom).toFixed(1)}px (max ${SHEET_FOOTER_BOTTOM_MAX_PX})`);
    });

    test(`w2 sheet Rezept: langer Inhalt, Speichern bleibt unten sichtbar, nichts liegt ueber dem Button (${at})`, SEED(), async (page) => {
      await page.setViewportSize(vp);
      await go(page, 'recipes');
      await page.getByRole('button', { name: 'Neues Rezept' }).click();
      const modal = topModal(page);
      await modal.locator(SHEET_FOOTER_BTN).waitFor();
      await settle(page, 900);
      const add = modal.locator('button', { hasText: 'Schritt hinzufügen' });
      for (let i = 0; i < 6; i++) await add.click();
      const m = await modal.evaluate(async (el) => {
        const content = el.querySelector('ion-content');
        await content.scrollToTop(0);
        await new Promise((r) => setTimeout(r, 300));
        const save = el.querySelector('.nt-sheet-footer .nt-btn').getBoundingClientRect();
        const wrapper = el.shadowRoot.querySelector('.modal-wrapper').getBoundingClientRect();
        const scrollEl = await content.getScrollElement();
        const hit = document.elementFromPoint(save.left + save.width / 2, save.top + save.height / 2);
        return { scrolls: scrollEl.scrollHeight > scrollEl.clientHeight + 1, saveBottom: save.bottom, wrapperBottom: wrapper.bottom, hitInFooter: !!hit?.closest('.nt-sheet-footer') };
      });
      assert.ok(m.scrolls, 'Inhalt scrollt nicht (Test braucht langen Inhalt)');
      assert.ok(m.wrapperBottom - m.saveBottom <= SHEET_FOOTER_BOTTOM_MAX_PX, `Speichern ${(m.wrapperBottom - m.saveBottom).toFixed(1)}px ueber der Sheet-Unterkante`);
      assert.ok(m.hitInFooter, 'Ueber dem Speichern-Button liegt ein anderes Element');
    });

    test(`w2 sheet Kochmodus: X rechts, 44x44, aria-label (${at})`, SEED(), async (page) => {
      await page.setViewportSize(vp);
      await go(page, 'recipes');
      await page.locator('.recipe__title-btn').first().click();
      await topModal(page).locator('ion-button', { hasText: 'Kochen' }).click();
      await page.locator('.cook__close').waitFor();
      await settle(page, 900);
      const m = await page.evaluate(() => {
        const q = (s) => document.querySelector(s)?.getBoundingClientRect() ?? null;
        return { vw: window.innerWidth, close: q('.cook__close'), title: q('.cook__title'), label: document.querySelector('.cook__close')?.getAttribute('aria-label') ?? '' };
      });
      assert.ok(m.close && m.title, 'X oder Titel fehlt');
      assert.ok(m.close.left >= m.title.right - 0.5, `X nicht rechts vom Titel (X ${m.close.left}, Titel bis ${m.title.right})`);
      assert.ok(m.vw - m.close.right <= CLOSE_END_MAX_PX, `X ${(m.vw - m.close.right).toFixed(1)}px vom rechten Rand`);
      assert.ok(Math.abs(m.close.width - ICON_BUTTON_PX) <= 0.6 && Math.abs(m.close.height - ICON_BUTTON_PX) <= 0.6, `X ${m.close.width}x${m.close.height}`);
      assert.ok(m.label.trim() !== '', 'X ohne aria-label');
    });
  }
}
