// Demo-Daten für das Seeding (Struktur wie in localStorage, Präfix `nutritrack:`).
const pad = (n) => String(n).padStart(2, '0');
const now = new Date();
export const TODAY = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
const ISO = now.toISOString();

export const facts = (kcal, proteinG, carbsG, fatG, fiberG = 0, sugarG = 0, basis = 'perPortion') =>
  ({ kcal, proteinG, carbsG, fatG, fiberG, sugarG, basis });

const entry = (id, meal, label, f, extra = {}) =>
  ({ id, dateISO: TODAY, meal, label, ref: { kind: 'manual' }, facts: f, createdAt: ISO, ...extra });

export const PROFILE = {
  weightKg: 78, heightCm: 180, age: 30, sex: 'male',
  activityLevel: 'moderate', goal: 'maintain', rateKgPerWeek: 0, updatedAt: ISO,
};

/** Eintrag mit Bezugswerten je 100 g → Menge im Bearbeiten-Dialog änderbar. */
export const SCALABLE_ENTRY = entry('e-scal', 'breakfast', 'Haferflocken', facts(370, 13, 59, 7, 10, 1), {
  amountG: 100, unit: 'g', baseFacts: facts(370, 13, 59, 7, 10, 1, 'per100g'),
});

export const DIARY_NORMAL = [
  SCALABLE_ENTRY,
  entry('e2', 'lunch', 'Linsencurry', facts(520, 24, 68, 14, 16, 8), { servings: 1 }),
  entry('e3', 'snack', 'Mandeln', facts(120, 4.2, 1.2, 10.8, 2.4, 0.8), { amountG: 20, unit: 'g' }),
];

export const DIARY_OVER = [
  ...DIARY_NORMAL,
  entry('e5', 'dinner', 'Pizza Salami', facts(1450, 60, 160, 62, 8, 14), { servings: 1 }),
  entry('e6', 'dinner', 'Tiramisu', facts(640, 9, 70, 34, 1, 40), { servings: 1 }),
  entry('e7', 'snack', 'Schokoriegel', facts(154, 2, 18, 8, 1, 16), { servings: 1 }),
];

export const SHOPPING = {
  id: 's1', dishes: 2, persons: 2, generatedAt: ISO, days: 3, store: 'Spar',
  items: [
    { name: 'Rote Linsen', amount: 400, unit: 'g', checked: false, estPrice: 2.3 },
    { name: 'Zwiebeln', amount: 3, unit: 'Stk', checked: false, estPrice: 0.9 },
  ],
};

/** Datum `daysAgo` Tage vor heute (ISO yyyy-mm-dd, lokale Zeit). */
export const daysAgoISO = (daysAgo) => {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysAgo);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/** Gewichtsverlauf über 15 Tage, fallend von 80,0 auf 78,6 kg. */
export const WEIGHT_HISTORY = [14, 10, 7, 3, 0].map((ago, i) => ({ dateISO: daysAgoISO(ago), kg: Math.round((80 - i * 0.35) * 10) / 10 }));

/** Eintrag an einem beliebigen Tag (für die Wochenansicht). */
export const entryOn = (dateISO, id, label, f) =>
  ({ id, dateISO, meal: 'lunch', label, ref: { kind: 'manual' }, facts: f, createdAt: ISO, servings: 1 });

/** Zustimmung zu KI- und Online-Funktionen (Version wie CONSENT_VERSION): Standard in allen Tests, damit kein Dialog dazwischenkommt. */
export const CONSENT = { version: 1, acceptedAt: ISO, isAdultConfirmed: true };

export const seed = (overrides = {}) => ({ profile: PROFILE, diary: [], recipes: [], consent: CONSENT, ...overrides });
