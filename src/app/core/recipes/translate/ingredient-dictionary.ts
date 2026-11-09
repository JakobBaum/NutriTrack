/**
 * Kleines Wörterbuch Englisch -> Deutsch für die häufigsten Zutaten (Grundform, Singular).
 * Fallback ohne KI: deterministisch und offline; Titel und Schritte bleiben dabei englisch.
 */
const WORDS: Readonly<Record<string, string>> = {
  // Fleisch, Fisch
  'pork shoulder': 'Schweineschulter', pork: 'Schweinefleisch', beef: 'Rindfleisch', 'ground beef': 'Rinderhackfleisch',
  'ground turkey': 'Putenhackfleisch', 'ground pork': 'Schweinehackfleisch', chicken: 'Hähnchen',
  'chicken breast': 'Hähnchenbrust', 'chicken thigh': 'Hähnchenschenkel', turkey: 'Pute', bacon: 'Speck', ham: 'Schinken',
  sausage: 'Wurst', lamb: 'Lammfleisch', steak: 'Steak', salmon: 'Lachs', tuna: 'Thunfisch', shrimp: 'Garnelen',
  prawns: 'Garnelen', cod: 'Kabeljau', fish: 'Fisch',
  // Milch, Eier
  egg: 'Ei', eggs: 'Ei', 'egg white': 'Eiweiß', 'egg yolk': 'Eigelb', milk: 'Milch', butter: 'Butter', cream: 'Sahne',
  'heavy cream': 'Sahne', 'sour cream': 'Sauerrahm', yogurt: 'Joghurt', 'greek yogurt': 'Griechischer Joghurt',
  cheese: 'Käse', 'cheddar cheese': 'Cheddar', 'parmesan cheese': 'Parmesan', parmesan: 'Parmesan',
  mozzarella: 'Mozzarella', feta: 'Feta', 'cream cheese': 'Frischkäse', 'cottage cheese': 'Hüttenkäse', tofu: 'Tofu',
  // Gemüse
  onion: 'Zwiebel', onions: 'Zwiebel', 'red onion': 'Rote Zwiebel', 'green onion': 'Frühlingszwiebel',
  scallion: 'Frühlingszwiebel', shallot: 'Schalotte', garlic: 'Knoblauch', 'garlic clove': 'Knoblauch',
  tomato: 'Tomate', tomatoes: 'Tomate', 'cherry tomatoes': 'Cherrytomaten', 'tomato paste': 'Tomatenmark',
  'tomato sauce': 'Tomatensauce', potato: 'Kartoffel', potatoes: 'Kartoffel', 'sweet potato': 'Süßkartoffel',
  carrot: 'Karotte', carrots: 'Karotte', celery: 'Sellerie', cucumber: 'Gurke', zucchini: 'Zucchini',
  'bell pepper': 'Paprika', 'red bell pepper': 'Paprika, rot', 'green bell pepper': 'Paprika, grün', pepper: 'Pfeffer',
  broccoli: 'Brokkoli', cauliflower: 'Blumenkohl', spinach: 'Spinat', lettuce: 'Salat', kale: 'Grünkohl',
  cabbage: 'Kohl', mushroom: 'Champignons', mushrooms: 'Champignons', corn: 'Mais', peas: 'Erbsen',
  'green beans': 'Grüne Bohnen', avocado: 'Avocado', eggplant: 'Aubergine', leek: 'Lauch', ginger: 'Ingwer',
  jalapeno: 'Jalapeño', chili: 'Chili', 'chili pepper': 'Chili', pumpkin: 'Kürbis', asparagus: 'Spargel',
  // Obst
  lemon: 'Zitrone', 'lemon juice': 'Zitronensaft', lime: 'Limette', 'lime juice': 'Limettensaft', orange: 'Orange',
  apple: 'Apfel', banana: 'Banane', strawberries: 'Erdbeeren', blueberries: 'Heidelbeeren', raspberries: 'Himbeeren',
  mango: 'Mango', pineapple: 'Ananas', raisins: 'Rosinen',
  // Kräuter, Gewürze
  rosemary: 'Rosmarin', 'fresh rosemary': 'Rosmarin, frisch', thyme: 'Thymian', 'fresh thyme': 'Thymian, frisch',
  oregano: 'Oregano', 'dried oregano': 'Oregano', basil: 'Basilikum', 'fresh basil': 'Basilikum, frisch',
  parsley: 'Petersilie', 'fresh parsley': 'Petersilie, frisch', cilantro: 'Koriander, frisch',
  'fresh cilantro': 'Koriander, frisch', coriander: 'Koriander', dill: 'Dill', 'fresh dill': 'Dill, frisch',
  mint: 'Minze', 'fresh mint': 'Minze, frisch', chives: 'Schnittlauch', sage: 'Salbei', 'bay leaf': 'Lorbeerblatt',
  'bay leaves': 'Lorbeerblatt', salt: 'Salz', 'sea salt': 'Salz', 'black pepper': 'Pfeffer',
  'ground black pepper': 'Pfeffer', paprika: 'Paprikapulver', 'smoked paprika': 'Paprikapulver, geräuchert',
  cumin: 'Kreuzkümmel', 'ground cumin': 'Kreuzkümmel', cinnamon: 'Zimt', 'ground cinnamon': 'Zimt',
  turmeric: 'Kurkuma', nutmeg: 'Muskat', 'chili powder': 'Chilipulver', 'cayenne pepper': 'Cayennepfeffer',
  'curry powder': 'Currypulver', 'garlic powder': 'Knoblauchpulver', 'onion powder': 'Zwiebelpulver',
  vanilla: 'Vanille', 'vanilla extract': 'Vanilleextrakt', 'red pepper flakes': 'Chiliflocken', mustard: 'Senf',
  // Öle, Saucen, Basics
  'olive oil': 'Olivenöl', 'extra virgin olive oil': 'Olivenöl', 'vegetable oil': 'Pflanzenöl', oil: 'Öl',
  'coconut oil': 'Kokosöl', 'sesame oil': 'Sesamöl', vinegar: 'Essig', 'balsamic vinegar': 'Balsamico',
  'apple cider vinegar': 'Apfelessig', 'soy sauce': 'Sojasauce', 'fish sauce': 'Fischsauce', honey: 'Honig',
  'maple syrup': 'Ahornsirup', sugar: 'Zucker', 'brown sugar': 'Brauner Zucker', 'powdered sugar': 'Puderzucker',
  flour: 'Mehl', 'all-purpose flour': 'Mehl', 'all purpose flour': 'Mehl', 'whole wheat flour': 'Vollkornmehl',
  cornstarch: 'Speisestärke', 'baking powder': 'Backpulver', 'baking soda': 'Natron', yeast: 'Hefe',
  water: 'Wasser', broth: 'Brühe', 'chicken broth': 'Hühnerbrühe', 'chicken stock': 'Hühnerbrühe',
  'vegetable broth': 'Gemüsebrühe', 'beef broth': 'Rinderbrühe', 'coconut milk': 'Kokosmilch', wine: 'Wein',
  'white wine': 'Weißwein', 'red wine': 'Rotwein', ketchup: 'Ketchup', mayonnaise: 'Mayonnaise', salsa: 'Salsa',
  'peanut butter': 'Erdnussbutter', 'hot sauce': 'Scharfe Sauce', 'worcestershire sauce': 'Worcestersauce',
  // Trockenware
  rice: 'Reis', 'brown rice': 'Naturreis', 'white rice': 'Reis', pasta: 'Nudeln', spaghetti: 'Spaghetti',
  noodles: 'Nudeln', quinoa: 'Quinoa', oats: 'Haferflocken', 'rolled oats': 'Haferflocken', couscous: 'Couscous',
  bread: 'Brot', breadcrumbs: 'Semmelbrösel', tortilla: 'Tortilla', tortillas: 'Tortilla', lentils: 'Linsen',
  'red lentils': 'Rote Linsen', chickpeas: 'Kichererbsen', 'black beans': 'Schwarze Bohnen',
  'kidney beans': 'Kidneybohnen', beans: 'Bohnen', almonds: 'Mandeln', walnuts: 'Walnüsse', cashews: 'Cashewkerne',
  peanuts: 'Erdnüsse', 'chia seeds': 'Chiasamen', 'sesame seeds': 'Sesam', cocoa: 'Kakao',
  'cocoa powder': 'Kakaopulver', chocolate: 'Schokolade', 'chocolate chips': 'Schokostückchen',
};

/** Wörter, die eine Zubereitungsart beschreiben und für den Einkauf entfallen. */
const PREP_WORDS = new Set([
  'chopped', 'diced', 'minced', 'sliced', 'grated', 'shredded', 'crushed', 'peeled', 'cubed', 'halved', 'fresh',
  'large', 'small', 'medium', 'boneless', 'skinless', 'cooked', 'raw', 'ripe', 'finely', 'roughly', 'thinly',
  'optional', 'divided', 'packed', 'frozen', 'drained', 'rinsed', 'toasted', 'whole', 'plain', 'unsalted', 'salted',
]);

const FRESH_HERBS = new Set(['rosemary', 'thyme', 'basil', 'parsley', 'cilantro', 'dill', 'mint', 'sage']);

function cleanWords(name: string): string[] {
  return name
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .split(/[,\s]+/)
    .filter((w) => w.length > 0);
}

/**
 * Übersetzt einen englischen Zutatennamen in die deutsche Einkaufs-Grundform.
 * „chopped fresh rosemary“ ergibt „Rosmarin, frisch“; Unbekanntes bleibt unverändert (nur getrimmt).
 */
export function translateIngredientName(name: string): string {
  const original = name.trim();
  const words = cleanWords(original);
  if (words.length === 0) return original;
  const fresh = words.includes('fresh');
  const core = words.filter((w) => !PREP_WORDS.has(w));
  const key = core.join(' ');
  const keyWithFresh = fresh ? `fresh ${key}` : key;
  const direct = WORDS[keyWithFresh] ?? WORDS[key];
  if (direct) {
    const herb = FRESH_HERBS.has(key) && fresh && !direct.endsWith(', frisch');
    return herb ? `${direct}, frisch` : direct;
  }
  // Längster passender Endteil („organic red onion“ -> „red onion“ -> „onion“).
  for (let start = 1; start < core.length; start++) {
    const tail = core.slice(start).join(' ');
    if (WORDS[tail]) return WORDS[tail];
  }
  return original;
}

/** Deutsches Wort -> englisches Suchwort (Umkehrung, nur Einzelwörter ohne Zusatz). */
const REVERSE: ReadonlyMap<string, string> = new Map(
  Object.entries(WORDS)
    .filter(([en]) => !en.includes(' ') && !en.endsWith('s') && en !== 'water')
    .map(([en, de]) => [de.toLowerCase(), en] as const)
    .concat([['hähnchen', 'chicken'], ['nudeln', 'pasta'], ['kartoffeln', 'potato'], ['eier', 'egg'], ['reis', 'rice']]),
);

/** Fallback der Suche ohne KI: ersetzt bekannte deutsche Wörter durch englische, Rest bleibt. */
export function translateQueryWithDictionary(query: string): string {
  return query
    .trim()
    .split(/\s+/)
    .map((w) => REVERSE.get(w.toLowerCase()) ?? w)
    .join(' ');
}

/** Anzahl der Wörterbucheinträge (für Tests). */
export const DICTIONARY_SIZE = Object.keys(WORDS).length;
