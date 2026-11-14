import { Intolerance } from '../models';

/**
 * Regeln für den Unverträglichkeits-Filter in der App (Zutatennamen und Titel, deutsch und englisch).
 * - `words`: ganze Wörter bzw. Wortfolgen (mit Beugung wie beim Abneigungs-Filter).
 * - `stems`: Wortteile für deutsche Zusammensetzungen (Vollmilch, Weizenmehl); nur eindeutige Stämme.
 * - `exceptions`: Wörter/Wortfolgen, die trotz Treffer nichts mit der Unverträglichkeit zu tun haben.
 * - `safeIf`: steht so etwas im Text, gilt der Text insgesamt als unbedenklich (z. B. "glutenfrei").
 * Die Listen sind eine Hilfe und erkennen keine Spuren oder versteckten Zutaten.
 */
export interface IntoleranceRule {
  readonly words: readonly string[];
  readonly stems: readonly string[];
  readonly exceptions: readonly string[];
  readonly safeIf: readonly string[];
}

const NUT_BUTTERS = ['peanut butter', 'almond butter', 'cashew butter', 'nut butter', 'erdnussbutter', 'mandelbutter'];
const PLANT_MILKS = [
  'coconut milk', 'almond milk', 'oat milk', 'soy milk', 'rice milk', 'cashew milk', 'hazelnut milk',
  'kokosmilch', 'mandelmilch', 'hafermilch', 'sojamilch', 'reismilch', 'cashewmilch', 'haselnussmilch',
];
const PLANT_YOGURTS = ['coconut yogurt', 'soy yogurt', 'almond yogurt', 'oat yogurt', 'sojajoghurt', 'kokosjoghurt'];

const DAIRY: IntoleranceRule = {
  words: [
    'milk', 'butter', 'buttermilk', 'cheese', 'cream', 'yogurt', 'yoghurt', 'whey', 'ghee', 'kefir', 'skyr', 'custard',
    'mozzarella', 'parmesan', 'cheddar', 'feta', 'ricotta', 'mascarpone', 'gouda', 'brie', 'camembert', 'halloumi',
    'creme fraiche', 'crème fraîche', 'crème', 'creme', 'milch', 'käse', 'sahne', 'joghurt', 'jogurt', 'quark', 'butter',
    'schmand', 'topfen', 'rahm', 'molke', 'obers',
  ],
  stems: ['milch', 'käse', 'sahne', 'joghurt', 'butter', 'rahm', 'quark', 'molke'],
  exceptions: [
    ...PLANT_MILKS, ...PLANT_YOGURTS, ...NUT_BUTTERS, 'coconut cream', 'cream of coconut', 'kokoscreme', 'kokossahne',
    'cream of tartar', 'cocoa butter', 'shea butter', 'kakaobutter', 'butter bean', 'butter beans', 'butterbohnen',
    'kokosbutter', 'coconut butter', 'butternut', 'butternusskürbis',
  ],
  safeIf: [],
};

const EGG: IntoleranceRule = {
  words: ['egg', 'yolk', 'egg white', 'albumen', 'mayonnaise', 'mayo', 'meringue', 'ei', 'eigelb', 'eiweiß', 'eiweiss', 'eischnee', 'mayonnaise'],
  stems: ['eigelb', 'eischnee', 'eiernudel', 'mayonnaise'],
  exceptions: ['eggplant', 'egg plant', 'aubergine'],
  safeIf: ['eggless', 'egg free', 'eifrei'],
};

const WHEAT_WORDS = [
  'wheat', 'flour', 'bread', 'breadcrumbs', 'pasta', 'spaghetti', 'penne', 'macaroni', 'noodles', 'lasagna', 'lasagne',
  'couscous', 'bulgur', 'semolina', 'seitan', 'farro', 'spelt', 'bun', 'bagel', 'tortilla', 'pita', 'croissant', 'cracker',
  'panko', 'pizza', 'toast', 'weizen', 'mehl', 'brot', 'brötchen', 'nudeln', 'nudel', 'grieß', 'dinkel', 'semmel',
  'semmelbrösel', 'paniermehl', 'spätzle', 'pizzateig',
];
const WHEAT_STEMS = ['weizen', 'mehl', 'nudel', 'brot', 'brötchen', 'semmel', 'dinkel'];
const NON_WHEAT_FLOURS = [
  'rice flour', 'almond flour', 'coconut flour', 'chickpea flour', 'corn flour', 'cornflour', 'potato flour', 'buckwheat flour',
  'reismehl', 'mandelmehl', 'kokosmehl', 'kichererbsenmehl', 'maismehl', 'kartoffelmehl', 'buchweizenmehl',
  'buckwheat', 'buchweizen', 'buchweizennudeln', 'soba', 'rice noodles', 'reisnudeln', 'glasnudeln', 'glass noodles',
];
const GLUTEN_FREE_MARKERS = ['gluten free', 'gluten-free', 'glutenfrei', 'glutenfreie', 'glutenfreier', 'glutenfreies'];

const WHEAT: IntoleranceRule = { words: WHEAT_WORDS, stems: WHEAT_STEMS, exceptions: NON_WHEAT_FLOURS, safeIf: GLUTEN_FREE_MARKERS };

const GLUTEN: IntoleranceRule = {
  words: [...WHEAT_WORDS, 'barley', 'rye', 'malt', 'beer', 'gluten', 'gerste', 'roggen', 'malz', 'bier'],
  stems: [...WHEAT_STEMS, 'roggen', 'gerste'],
  exceptions: NON_WHEAT_FLOURS,
  safeIf: GLUTEN_FREE_MARKERS,
};

const PEANUT: IntoleranceRule = {
  words: ['peanut', 'groundnut', 'arachis', 'erdnuss', 'erdnüsse', 'erdnussbutter', 'erdnussöl'],
  stems: ['erdnuss', 'erdnüss'],
  exceptions: [],
  safeIf: [],
};

const TREE_NUT: IntoleranceRule = {
  words: [
    'nut', 'nuts', 'almond', 'walnut', 'hazelnut', 'cashew', 'pecan', 'pistachio', 'macadamia', 'brazil nut', 'pine nut',
    'chestnut', 'marzipan', 'praline', 'nuss', 'nüsse', 'mandel', 'cashewkerne', 'pistazie', 'pinienkerne', 'kastanie',
  ],
  stems: ['walnuss', 'walnüss', 'haselnuss', 'haselnüss', 'paranuss', 'paranüss', 'pekannuss', 'pekannüss', 'mandel', 'cashew', 'pistazi', 'macadamia', 'marzipan'],
  exceptions: ['nutmeg', 'muskatnuss', 'muskatnüsse', 'butternut', 'butternut squash'],
  safeIf: [],
};

const SHELLFISH_WORDS = [
  'shellfish', 'shrimp', 'shrimps', 'prawn', 'crab', 'lobster', 'crayfish', 'langoustine', 'scampi', 'mussel', 'clam', 'oyster',
  'scallop', 'squid', 'calamari', 'octopus', 'garnele', 'krabbe', 'hummer', 'krebs', 'muschel', 'auster', 'jakobsmuschel',
  'tintenfisch', 'schalentiere', 'meeresfrüchte',
];
const SHELLFISH_STEMS = ['garnele', 'krabbe', 'muschel', 'tintenfisch', 'meeresfrüchte', 'schalentier'];

const SHELLFISH: IntoleranceRule = { words: SHELLFISH_WORDS, stems: SHELLFISH_STEMS, exceptions: [], safeIf: [] };

const SEAFOOD: IntoleranceRule = {
  words: [
    ...SHELLFISH_WORDS, 'fish', 'seafood', 'salmon', 'tuna', 'cod', 'tilapia', 'trout', 'haddock', 'mackerel', 'sardine', 'anchovy',
    'herring', 'halibut', 'sea bass', 'surimi', 'caviar', 'fisch', 'lachs', 'thunfisch', 'forelle', 'kabeljau', 'dorade', 'makrele',
    'sardelle', 'anchovis', 'hering', 'meeresfrüchte',
  ],
  stems: [...SHELLFISH_STEMS, 'fisch', 'lachs', 'thunfisch', 'forelle', 'kabeljau', 'makrele'],
  exceptions: ['fischer', 'cat fish food'],
  safeIf: [],
};

const SOY: IntoleranceRule = {
  words: ['soy', 'soya', 'soybean', 'soybeans', 'tofu', 'edamame', 'tempeh', 'miso', 'tamari', 'shoyu', 'natto', 'soja', 'sojasauce', 'sojasoße'],
  stems: ['soja', 'tofu', 'edamame', 'tempeh'],
  exceptions: [],
  safeIf: [],
};

const SESAME: IntoleranceRule = {
  words: ['sesame', 'tahini', 'tahina', 'halva', 'sesam', 'tahin'],
  stems: ['sesam', 'tahin'],
  exceptions: [],
  safeIf: [],
};

export const INTOLERANCE_RULES: Readonly<Record<Intolerance, IntoleranceRule>> = {
  dairy: DAIRY,
  egg: EGG,
  gluten: GLUTEN,
  peanut: PEANUT,
  'tree nut': TREE_NUT,
  seafood: SEAFOOD,
  shellfish: SHELLFISH,
  soy: SOY,
  wheat: WHEAT,
  sesame: SESAME,
};
