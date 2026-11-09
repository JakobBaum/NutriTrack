/** Dichte (g je ml) der häufigsten Zutaten, um Volumenmaße (Tasse, EL, TL) in Gramm umzurechnen. */
interface DensityEntry {
  /** Teilwörter im kleingeschriebenen Namen (deutsch und englisch). */
  keywords: readonly string[];
  gPerMl: number;
}

/** Flüssigkeiten bleiben in ml (Dichte ~1). */
const LIQUID_KEYWORDS: readonly string[] = [
  'wasser', 'water', 'milch', 'milk', 'öl', 'oil', 'essig', 'vinegar', 'brühe', 'broth', 'stock', 'sahne', 'cream',
  'saft', 'juice', 'wein', 'wine', 'sojasauce', 'soy sauce', 'joghurt', 'yogurt', 'buttermilch', 'buttermilk',
  'kokosmilch', 'coconut milk', 'bier', 'beer', 'sirup', 'syrup', 'sauce', 'soße', 'passata', 'kaffee', 'coffee',
];

/** Reihenfolge: spezifische Einträge zuerst (z. B. „brauner zucker“ vor „zucker“). */
const DENSITIES: readonly DensityEntry[] = [
  { keywords: ['brauner zucker', 'brown sugar', 'rohrzucker'], gPerMl: 0.93 },
  { keywords: ['puderzucker', 'powdered sugar', 'icing sugar'], gPerMl: 0.56 },
  { keywords: ['zucker', 'sugar'], gPerMl: 0.85 },
  { keywords: ['mehl', 'flour'], gPerMl: 0.53 },
  { keywords: ['stärke', 'starch', 'cornstarch'], gPerMl: 0.55 },
  { keywords: ['erdnussbutter', 'peanut butter'], gPerMl: 1.08 },
  { keywords: ['butter', 'margarine'], gPerMl: 0.96 },
  { keywords: ['honig', 'honey'], gPerMl: 1.42 },
  { keywords: ['haferflocken', 'oats'], gPerMl: 0.35 },
  { keywords: ['reis', 'rice'], gPerMl: 0.85 },
  { keywords: ['quinoa'], gPerMl: 0.72 },
  { keywords: ['linsen', 'lentil'], gPerMl: 0.8 },
  { keywords: ['bohnen', 'beans', 'kichererbsen', 'chickpeas'], gPerMl: 0.75 },
  { keywords: ['kakao', 'cocoa'], gPerMl: 0.5 },
  { keywords: ['salz', 'salt'], gPerMl: 1.2 },
  { keywords: ['backpulver', 'baking powder', 'natron', 'baking soda'], gPerMl: 0.9 },
  { keywords: ['semmelbrösel', 'paniermehl', 'breadcrumbs'], gPerMl: 0.45 },
  { keywords: ['parmesan', 'käse', 'cheese'], gPerMl: 0.42 },
  { keywords: ['nüsse', 'nuts', 'walnuss', 'walnut', 'mandel', 'almond', 'cashew'], gPerMl: 0.55 },
  { keywords: ['rosinen', 'raisins'], gPerMl: 0.65 },
  { keywords: ['schokolade', 'chocolate', 'chips'], gPerMl: 0.7 },
  { keywords: ['spinat', 'spinach', 'salat', 'lettuce', 'rucola', 'arugula'], gPerMl: 0.12 },
  { keywords: ['brokkoli', 'broccoli', 'blumenkohl', 'cauliflower'], gPerMl: 0.3 },
  { keywords: ['zwiebel', 'onion'], gPerMl: 0.65 },
  { keywords: ['tomatenmark', 'tomato paste'], gPerMl: 1.1 },
  { keywords: ['tomate', 'tomato'], gPerMl: 0.6 },
  { keywords: ['karotte', 'möhre', 'carrot'], gPerMl: 0.55 },
  { keywords: ['frischkäse', 'cream cheese', 'quark', 'schmand', 'sour cream'], gPerMl: 1.0 },
];

export interface Density {
  /** Gramm je ml; null = Flüssigkeit oder unbekannt (Mengen bleiben in ml). */
  gPerMl: number | null;
  /** True, wenn weder Flüssigkeit noch Tabelleneintrag: Umrechnung ml = g, nur ungefähr. */
  approx: boolean;
}

/** Dichte einer Zutat über den (de/en) Namen. Spezifische Einträge (Frischkäse) vor Flüssigkeiten (Sahne). */
export function densityOf(name: string): Density {
  const n = name.trim().toLowerCase();
  const hit = DENSITIES.find((d) => d.keywords.some((k) => n.includes(k)));
  if (hit) return { gPerMl: hit.gPerMl, approx: false };
  if (LIQUID_KEYWORDS.some((k) => n.includes(k))) return { gPerMl: null, approx: false };
  return { gPerMl: null, approx: true };
}
