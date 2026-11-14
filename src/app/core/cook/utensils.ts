import { normalizeText } from './cook-text';

/** Ein Utensil mit Erkennungsmuster auf dem normalisierten Schritttext (nur a-z, ohne Umlaute). */
interface UtensilRule {
  readonly label: string;
  readonly pattern: RegExp;
}

const re = (source: string): RegExp => new RegExp(source, 'u');

/**
 * Reihenfolge = Reihenfolge der Anzeige: Vorbereiten, Kochgeschirr, Backzubehör, Hitzequellen.
 * Muster stehen auf normalisiertem Text (Umlaute gefaltet), deutsch und englisch.
 */
const UTENSIL_RULES: readonly UtensilRule[] = [
  { label: 'Küchenwaage', pattern: re('\\b(?:\\w*waage|kitchen scales?|food scale)\\b') },
  {
    label: 'Messer und Schneidebrett',
    pattern: re('\\b(?:messer|schneidebrett|brett|schneid(?:en|e|et|st)|geschnitten|hack(?:en|e|st|t)|gehackt\\w*|wurfel\\w*|gewurfelt\\w*|knife|cutting board|chopping board|chop\\w*|dice[ds]?|slic(?:e|es|ed|ing)|mince[ds]?|julienne)\\b') },
  { label: 'Schüssel', pattern: re('\\b(?:\\w*schussel|bowls?|vermengen|vermischen|verkneten|kneten|knead\\w*)\\b') },
  { label: 'Schneebesen', pattern: re('\\b(?:schneebesen|(?:auf|ver)?schlag(?:en|e|t|st)?|geschlagen|verquirl\\w*|quirl\\w*|whisk\\w*)\\b') },
  { label: 'Reibe', pattern: re('\\b(?:reibe\\w*|reib(?:en|e|t)|gerieben\\w*|raspel\\w*|grat(?:e|er|ed|ing))\\b') },
  { label: 'Nudelholz', pattern: re('\\b(?:nudelholz|rolling pin|ausrollen|ausgerollt\\w*)\\b') },
  { label: 'Mixer oder Pürierstab', pattern: re('\\b(?:\\w*mixer|mixen|puriersta[bn]\\w*|puriere\\w*|pureed?|blender|blend(?:ed|ing)?|food processor|kuchenmaschine)\\b') },
  { label: 'Sieb', pattern: re('\\b(?:\\w*sieb|durchsieb\\w*|absieb\\w*|abgiess\\w*|abtropf\\w*|abseih\\w*|strain\\w*|colander|sieve|sift\\w*|drain\\w*)\\b') },
  { label: 'Topf', pattern: re('\\b(?:\\w*topf|\\w*topfe|saucepan|pots?|stockpot|aufkoch\\w*|kocheln|kochen|koche|kocht|gekocht\\w*|simmer\\w*|boil\\w*|blanchier\\w*)\\b') },
  { label: 'Pfanne', pattern: re('\\w*pfanne\\w*|(?<!baking |cake |loaf |roasting |bread |muffin )\\b(?:pans?|skillets?)\\b|\\b(?:an|ab)?brat(?:en|e|et|st)\\b|\\b(?:fry|fried|frying|saute\\w*|sear\\w*)\\b') },
  { label: 'Wok', pattern: re('\\bwoks?\\b') },
  { label: 'Backpapier', pattern: re('\\b(?:backpapier|backmatte|silikonmatte|parchment(?: paper)?|baking paper|greaseproof paper)\\b') },
  { label: 'Backblech', pattern: re('\\b(?:backblech|\\w*blech|baking sheets?|baking trays?|sheet pans?|cookie sheets?)\\b') },
  {
    label: 'Backform',
    pattern: re('\\b(?:backform|kastenform|springform|tarteform|muffinform|baking (?:tin|pan)|cake (?:tin|pan)|loaf (?:tin|pan)|muffin (?:tin|pan)|tart pan)\\b'),
  },
  { label: 'Auflaufform', pattern: re('\\b(?:auflaufform|baking dish|casserole(?: dish)?)\\b') },
  {
    label: 'Backofen',
    pattern: re('\\b(?:backofen|ofen|oven|vorheiz\\w*|preheat\\w*|oberhitze|unterhitze|umluft|heissluft|back(?:en|e|t|st)|gebacken|uberback\\w*|bake[ds]?|baking(?! (?:powder|soda|pan|tin|dish|sheet|tray|paper))|roast(?:ed|ing)?|gratin\\w*)\\b'),
  },
  { label: 'Alufolie', pattern: re('\\b(?:alufolie|aluminium ?folie|alumin(?:i)?um foil|tin foil)\\b') },
  { label: 'Grill', pattern: re('\\bgrill\\w*') },
  { label: 'Mikrowelle', pattern: re('\\b(?:mikrowelle\\w*|microwave\\w*)\\b') },
];

/** Benötigte Utensilien aus allen Schritten: deutsche Namen, ohne Dopplungen, in sinnvoller Reihenfolge. */
export function utensilsFor(steps: readonly string[]): string[] {
  const text = normalizeText(steps.join('\n'));
  if (text.trim() === '') return [];
  return UTENSIL_RULES.filter((rule) => rule.pattern.test(text)).map((rule) => rule.label);
}
