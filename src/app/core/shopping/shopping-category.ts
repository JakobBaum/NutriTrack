import { ShoppingItem } from '../models';

/** Feste Supermarkt-Kategorien (Gruppen erscheinen in Reihenfolge des ersten Auftretens). */
export const SHOPPING_CATEGORIES = [
  'Obst & Gemüse',
  'Kühlregal/Milchprodukte',
  'Fleisch & Fisch',
  'Brot & Backwaren',
  'Trockenware/Nudeln/Reis',
  'Konserven & Saucen',
  'Gewürze & Öle',
  'Tiefkühl',
  'Getränke',
  'Sonstiges',
] as const;

export type ShoppingCategory = (typeof SHOPPING_CATEGORIES)[number];

/** Kategorie für alles, was kein Stichwort trifft. */
export const DEFAULT_SHOPPING_CATEGORY: ShoppingCategory = 'Sonstiges';

/**
 * Stichwort-Schreibweise: normal = Teilwort (ab 4 Zeichen, kürzere nur als ganzes Wort),
 * `=wort` = ganzes Wort, `wort$` = Wortende.
 */
interface CategoryRule {
  category: ShoppingCategory;
  keywords: readonly string[];
}

/** Reihenfolge ist wichtig: spezifische Regeln vor allgemeinen (z. B. Tiefkühl vor Fisch). */
const RULES: readonly CategoryRule[] = [
  {
    category: 'Tiefkühl',
    keywords: [
      'tiefkühl', 'tk-', 'gefror', 'frozen', 'fischstäbchen', 'tiefgekühl', '=eis', 'eiscreme', 'ice cream', 'pommes',
    ],
  },
  {
    category: 'Gewürze & Öle',
    keywords: [
      'öl$', '=öl', 'oil', 'essig', 'vinegar', 'salz', 'salt', 'pfeffer', 'pepper', 'gewürz', 'spice', 'zimt', 'cinnamon',
      'paprikapulver', 'currypulver', 'curry', 'chilipulver', 'chili', 'knoblauchpulver', 'zwiebelpulver', 'kurkuma',
      'turmeric', 'kreuzkümmel', 'kümmel', 'cumin', 'oregano', 'thymian', 'thyme', 'rosmarin', 'rosemary', 'basilikum',
      'basil', 'muskat', 'nutmeg', 'vanille', 'vanilla', 'lorbeer', 'cayenne', 'koriander', 'senf', 'mustard', 'majoran',
      'ingwerpulver', 'brühwürfel',
    ],
  },
  {
    category: 'Getränke',
    keywords: [
      'saft', 'juice', 'wasser', 'water', 'cola', 'limo', 'bier', 'beer', 'wein', 'wine', 'sekt', 'prosecco', '=tee',
      'kaffee', 'coffee', 'getränk', 'drink', 'sprudel', 'smoothie', 'wodka', 'vodka', '=rum',
    ],
  },
  {
    category: 'Konserven & Saucen',
    keywords: [
      'konserve', 'dose', 'canned', 'passierte', 'tomatenmark', 'tomato paste', 'sauce', 'soße', 'ketchup', 'mayo',
      'pesto', 'brühe', 'broth', '=stock', 'bouillon', 'kokosmilch', 'coconut milk', 'gehackte tomaten', '=mais',
      'kichererbsen', 'chickpeas', 'kidneybohnen', 'oliven', 'olives', 'gewürzgurken', 'pickles', 'sauerkraut',
      'marmelade', '=jam', 'honig', 'honey', 'nutella', 'aufstrich', 'erdnussbutter', 'peanut butter', 'tahini',
      'sambal', 'sriracha', 'dressing',
    ],
  },
  {
    category: 'Trockenware/Nudeln/Reis',
    keywords: [
      'nudel', 'pasta', 'spaghetti', 'penne', 'fusilli', 'tagliatelle', 'lasagneplatten', 'makkaroni', 'macaroni', 'reis',
      'rice', 'couscous', 'bulgur', 'quinoa', 'hirse', 'polenta', 'grieß', 'mehl', 'flour', 'zucker', 'sugar',
      'haferflocken', 'oats', 'müsli', 'muesli', 'cornflakes', 'linsen', 'lentil', 'backpulver', 'hefe', 'yeast',
      'stärke', 'starch', 'semmelbrösel', 'paniermehl', 'breadcrumbs', 'nüsse', 'nuts', 'mandel', 'almond', 'walnuss',
      'cashew', 'erdnuss', 'peanut', 'rosinen', 'raisins', 'kakao', 'cocoa', 'schokolade', 'chocolate', 'chips',
      'cracker', 'keks', 'sesam', 'leinsamen', 'chiasamen', 'trockenfrüchte',
    ],
  },
  {
    category: 'Brot & Backwaren',
    keywords: [
      'brot', 'bread', 'brötchen', 'semmel', 'toast', 'baguette', 'croissant', 'tortilla', '=wrap', 'wraps', 'pita',
      'laugen', 'kuchen', 'cake', 'gebäck', 'zwieback', 'bagel', 'ciabatta', 'naan', 'pizzateig', 'blätterteig', 'teig',
      'dough',
    ],
  },
  {
    category: 'Fleisch & Fisch',
    keywords: [
      'fleisch', 'meat', 'hack', 'hähnchen', 'hühn', 'chicken', '=pute', 'putenbrust', 'truthahn', 'turkey', 'rind', 'beef',
      'schwein', 'pork', 'kalb', 'veal', 'lamm', 'lamb', 'wurst', 'sausage', 'salami', 'schinken', '=ham', 'speck',
      'bacon', 'steak', 'filet', 'schnitzel', 'gulasch', '=ente', 'fisch', 'fish', 'lachs', 'salmon', 'thunfisch', 'tuna',
      'forelle', 'kabeljau', '=cod', 'garnele', 'shrimp', 'prawn', 'scampi', 'meeresfrüchte', 'seafood', 'sardine',
      'hering', 'matjes', 'leberkäse', 'krabben', 'muschel', 'tintenfisch',
    ],
  },
  {
    category: 'Kühlregal/Milchprodukte',
    keywords: [
      'milch', 'milk', 'joghurt', 'yogurt', 'yoghurt', 'quark', 'käse', 'cheese', 'butter', 'sahne', 'cream', 'schmand',
      'crème', 'mozzarella', 'parmesan', 'feta', 'gouda', 'emmentaler', 'cheddar', 'ricotta', 'mascarpone', 'halloumi',
      'skyr', 'kefir', '=ei', '=eier', 'eier', '=egg', '=eggs', 'margarine', 'tofu', 'tempeh', 'seitan', 'hummus',
      'pudding', 'gnocchi', 'maultaschen', 'tortellini',
    ],
  },
  {
    category: 'Obst & Gemüse',
    keywords: [
      'obst', 'gemüse', 'fruit', 'vegetable', 'apfel', 'äpfel', 'apple', 'birne', 'pear', 'banane', 'banana', 'orange',
      'zitrone', 'lemon', 'limette', '=lime', 'traube', 'grape', 'beere', 'berry', 'erdbeer', 'himbeer', 'heidelbeer',
      'blaubeer', 'kirsche', 'cherry', 'pfirsich', 'peach', 'nektarine', 'pflaume', 'plum', 'mango', 'ananas',
      'pineapple', 'melone', 'melon', 'kiwi', 'avocado', 'granatapfel', 'feige', 'datteln', 'tomate', 'tomato', 'gurke',
      'cucumber', 'paprika', 'pepperoni', 'zucchini', 'aubergine', 'eggplant', 'karotte', 'möhre', 'carrot', 'kartoffel',
      'potato', 'zwiebel', 'onion', 'lauch', 'leek', 'knoblauch', 'garlic', 'ingwer', 'ginger', 'salat', 'salad',
      'lettuce', 'rucola', 'arugula', 'spinat', 'spinach', 'kohl', 'cabbage', 'brokkoli', 'broccoli', 'blumenkohl',
      'cauliflower', 'kürbis', 'pumpkin', 'squash', 'sellerie', 'celery', 'fenchel', 'fennel', 'radieschen', 'radish',
      'rübe', '=beet', 'spargel', 'asparagus', 'erbsen', '=peas', 'bohnen', '=beans', 'pilz', 'champignon', 'mushroom',
      'petersilie', 'parsley', 'schnittlauch', 'chives', '=dill', 'minze', '=mint', 'sprossen', 'mangold', 'pak choi',
    ],
  },
];

/** Kleinschreibung, ohne Rand-Leerzeichen, mehrfache Leerzeichen zusammengefasst. */
function normalizeText(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Prüft ein Stichwort gegen den normalisierten Namen und seine Wörter. */
function matchesKeyword(name: string, words: readonly string[], keyword: string): boolean {
  if (keyword.startsWith('=')) return words.includes(keyword.slice(1));
  if (keyword.endsWith('$')) {
    const suffix = keyword.slice(0, -1);
    return words.some((w) => w.endsWith(suffix));
  }
  if (keyword.length < 4) return words.includes(keyword);
  return name.includes(keyword);
}

/** Ordnet einen Zutatennamen (de/en) einer Kategorie zu; ohne Treffer „Sonstiges“. */
export function categorizeName(name: string): ShoppingCategory {
  const normalized = normalizeText(name);
  if (!normalized) return DEFAULT_SHOPPING_CATEGORY;
  const words = normalized.split(/[^a-zäöüß-]+/).filter(Boolean);
  const rule = RULES.find((r) => r.keywords.some((k) => matchesKeyword(normalized, words, k)));
  return rule?.category ?? DEFAULT_SHOPPING_CATEGORY;
}

/** Validiert einen Rohwert (z. B. aus der KI): gültige Kategorie (ohne Groß-/Kleinschreibung) oder null. */
export function normalizeCategory(raw: unknown): ShoppingCategory | null {
  if (typeof raw !== 'string') return null;
  const wanted = normalizeText(raw);
  return SHOPPING_CATEGORIES.find((c) => c.toLowerCase() === wanted) ?? null;
}

/** Liefert die Position mit gültiger Kategorie; eine vorhandene gültige bleibt, sonst Stichwort-Zuordnung. */
export function withCategory<T extends ShoppingItem>(item: T): T {
  const category = normalizeCategory(item.category) ?? categorizeName(item.name);
  return item.category === category ? item : { ...item, category };
}

/** Wie {@link withCategory} für eine ganze Liste (neue Liste, Eingabe bleibt unverändert). */
export function withCategories<T extends ShoppingItem>(items: readonly T[]): T[] {
  return items.map(withCategory);
}
