/**
 * Richtpreise für die häufigsten Zutaten (Österreich, Supermarkt, eher konservativ).
 * Reine Daten; die Berechnung steht in ingredient-price.ts.
 */
export type PriceBasis = 'kg' | 'l' | 'pc' | 'pack';

export interface PriceEntry {
  /** Suchwörter (klein, Singular); Wörter mit Leerzeichen werden im ganzen Namen gesucht. */
  keys: readonly string[];
  basis: PriceBasis;
  /** EUR je kg bzw. l (kg, l), je Stück (pc) oder je Packung/Bund/Topf (pack). */
  price: number;
  /** Übliche Packungsgröße in g bzw. ml; gekauft wird ein Vielfaches davon. */
  packG?: number;
  /** Gewicht eines Stücks in g (für Stück <-> Gramm). */
  pieceG?: number;
}

const kg = (keys: string, price: number, packG?: number, pieceG?: number): PriceEntry =>
  ({ keys: keys.split(','), basis: 'kg', price, packG, pieceG });
const lit = (keys: string, price: number, packG?: number): PriceEntry =>
  ({ keys: keys.split(','), basis: 'l', price, packG });
const pc = (keys: string, price: number, pieceG?: number): PriceEntry =>
  ({ keys: keys.split(','), basis: 'pc', price, pieceG });
const pack = (keys: string, price: number): PriceEntry => ({ keys: keys.split(','), basis: 'pack', price });

/** Spezifische Einträge zuerst („brauner zucker“ vor „zucker“, „rote linsen“ vor „linsen“). */
export const PRICE_TABLE: readonly PriceEntry[] = [
  // Gemüse
  kg('zwiebel', 1.99, 1000, 80), pc('knoblauch', 0.69, 50), kg('süßkartoffel', 3.99, undefined, 300),
  kg('kartoffel', 1.89, 2000, 120), kg('karotte,möhre', 1.49, 1000, 80), kg('paprika', 4.99, undefined, 160),
  kg('cherrytomaten', 5.99, 250, 15), kg('tomate', 3.99, undefined, 120), pc('gurke', 0.89, 350),
  kg('zucchini', 3.49, undefined, 250), kg('aubergine', 3.99, undefined, 300), pc('brokkoli', 1.29, 400),
  pc('blumenkohl', 2.29, 600), kg('spinat', 7.99, 300), pc('salat', 1.29, 300), kg('rucola', 14, 100),
  kg('champignon,pilz', 6.99, 250), kg('lauch', 3.49, undefined, 200), kg('sellerie', 2.99, undefined, 400),
  kg('kürbis', 2.49, undefined, 800), pc('avocado', 1.19, 200), kg('ingwer', 8.99, 100, 30), pc('zitrone', 0.49, 100),
  pc('limette', 0.49, 70), pack('frühlingszwiebel', 1.29), kg('schalotte', 7.99, 250, 30), kg('chili', 14, 100, 15),
  kg('grünkohl,kohl', 1.99, undefined, 1000), kg('mais', 4.5, 400), kg('erbsen', 3.99, 450),
  kg('grüne bohnen', 5.99, 400), kg('spargel', 9.99, 500), kg('rote bete', 2.99, 500),
  // Obst
  kg('apfel', 2.99, undefined, 180), kg('banane', 1.99, undefined, 120), kg('orange', 2.49, undefined, 200),
  kg('birne', 3.49, undefined, 180), kg('erdbeere', 9.99, 250), kg('heidelbeere', 14.9, 125),
  kg('himbeere', 16, 125), pc('mango', 1.79, 350), pc('ananas', 2.49, 1000), kg('trauben', 4.99, 500),
  kg('rosinen', 6.99, 200),
  // Fleisch und Fisch
  kg('schweineschulter', 7.99), kg('schweinehack,schweinehackfleisch', 8.99), kg('schweinefleisch', 8.99),
  kg('hähnchenbrust', 10.99), kg('hähnchenschenkel', 6.99), kg('hähnchen', 8.99), kg('rinderhack,rinderhackfleisch', 10.99),
  kg('hackfleisch', 8.99), kg('rindfleisch', 16.99), kg('steak', 24.99), kg('pute,putenbrust,putenhackfleisch', 11.99),
  kg('lammfleisch', 19.99), kg('speck', 14.99, 150), kg('schinken', 15.99, 100), kg('wurst', 10.99, 200),
  kg('lachs', 21.99, 250), pc('thunfisch', 1.79, 150), kg('garnele', 19.99, 250), kg('kabeljau', 22.99, 300),
  kg('fisch', 16.99, 300),
  // Milch, Eier, Käse
  lit('milch', 1.49, 1000), lit('sahne', 3.6, 250), kg('sauerrahm', 3, 200), kg('griechischer joghurt', 3.99, 500),
  kg('skyr', 3.5, 450), kg('joghurt', 2.49, 500), kg('quark', 3, 250), kg('butter', 8.99, 250), kg('parmesan', 19.99, 100),
  kg('mozzarella', 9.5, 125), kg('feta', 8.99, 200), kg('frischkäse', 6.99, 200), kg('hüttenkäse', 4.99, 200),
  kg('cheddar,käse', 11.99, 150), pc('ei', 0.39, 60), kg('eiweiß', 6, 500), kg('tofu', 7.99, 200),
  // Trockenware und Backen
  kg('rote linsen,linsen', 4.5, 500), kg('nudeln,spaghetti,pasta,penne', 2.2, 500), kg('reis,naturreis', 3.2, 500),
  kg('haferflocken', 2, 500), kg('mehl,vollkornmehl', 1.2, 1000), kg('brauner zucker', 3.5, 500),
  kg('puderzucker', 3, 500), kg('zucker', 1.5, 1000), kg('quinoa', 8.9, 500), kg('couscous', 3.5, 500),
  kg('kichererbsen,bohnen,kidneybohnen', 3, 400), kg('semmelbrösel', 3.5, 400), kg('speisestärke', 4, 250),
  pack('backpulver', 0.99), pack('natron', 0.89), pack('hefe', 0.69), kg('mandel', 12.9, 200), kg('walnuss', 14.9, 200),
  kg('cashewkerne', 17.9, 200), kg('erdnuss', 8.9, 250), kg('chiasamen', 14.9, 250), kg('sesam', 12, 200),
  kg('kakaopulver,kakao', 14, 125), kg('schokolade,schokostückchen', 11.9, 100),
  // Saucen, Öle, Konserven
  kg('tomatenmark', 6, 200), kg('passierte tomaten', 2.6, 500), kg('tomatensauce', 3.5, 400),
  lit('kokosmilch', 4, 400), pack('brühwürfel', 1.99), lit('hühnerbrühe,gemüsebrühe,rinderbrühe,brühe', 3, 500),
  lit('sojasauce', 6.9, 250), lit('fischsauce', 8, 200), kg('honig', 9.9, 250), lit('ahornsirup', 19.9, 250),
  kg('ketchup', 3.5, 500), kg('mayonnaise', 4, 250), kg('senf', 4, 200), lit('balsamico', 6.9, 250),
  lit('essig,apfelessig', 1.9, 500), lit('olivenöl', 8.9, 500), lit('pflanzenöl,öl', 2.5, 1000),
  kg('kokosöl', 9.9, 250), lit('sesamöl', 15, 250), lit('rotwein,weißwein,wein', 5, 750), kg('erdnussbutter', 6, 350),
  kg('salsa', 4.5, 300), lit('saft,zitronensaft,limettensaft', 1.8, 1000), { keys: ['wasser'], basis: 'l', price: 0 },
  // Brot
  kg('brot', 4.5, 500), pc('tortilla', 0.3, 40), kg('toast', 3, 500), pc('semmel,brötchen', 0.35, 50),
  // Gewürze und Kräuter (je Packung/Bund/Topf)
  pack('salz', 0.99), pack('pfeffer', 1.99), pack('paprikapulver', 1.79), pack('zimt', 1.79), pack('kreuzkümmel', 1.79),
  pack('kurkuma', 1.89), pack('muskat', 1.99), pack('chilipulver,chiliflocken,cayennepfeffer', 1.79),
  pack('currypulver,curry', 1.79), pack('knoblauchpulver,zwiebelpulver,ingwerpulver', 1.79), pack('vanille', 1.99),
  pack('oregano,thymian,majoran,lorbeerblatt,lorbeer', 1.49), pack('rosmarin,salbei,minze,koriander', 1.49),
  pack('basilikum', 1.99), pack('petersilie,schnittlauch,dill', 1.29),
];

/** Rückfall für unbekannte Gewürze/Kräuter. */
export const DEFAULT_SPICE_PRICE = 1.79;
