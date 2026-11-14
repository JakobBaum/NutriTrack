import { describe, expect, it } from 'vitest';
import { stepIngredientsByStep, stepIngredientsFor } from './step-ingredients';

interface Ing { name: string; amount: number; unit: string }
const ing = (name: string, amount = 1, unit = 'g'): Ing => ({ name, amount, unit });
const names = (list: readonly Ing[]): string[] => list.map((i) => i.name);

describe('stepIngredientsFor (Deutsch)', () => {
  const list = [ing('Zwiebel', 2, 'Stk'), ing('Tomaten', 400), ing('Olivenöl', 2, 'EL'), ing('Reis', 200), ing('Ei', 2, 'Stk')];

  it('findet Zutaten im Plural und Singular', () => {
    expect(names(stepIngredientsFor('Die Zwiebeln fein würfeln und die Tomate dazugeben.', list))).toEqual(['Zwiebel', 'Tomaten']);
  });

  it('trifft nicht ohne Wortgrenze: Ei steckt nicht in Reis, einrühren, Eis', () => {
    expect(names(stepIngredientsFor('Den Reis kochen, Sahne einrühren und mit Eis servieren.', list))).toEqual(['Reis']);
  });

  it('findet Ei und Eier', () => {
    expect(names(stepIngredientsFor('Die Eier verquirlen.', list))).toEqual(['Ei']);
    expect(names(stepIngredientsFor('Ein Ei aufschlagen.', list))).toEqual(['Ei']);
  });

  it('ignoriert Groß-/Kleinschreibung', () => {
    expect(names(stepIngredientsFor('TOMATEN und zwiebel', list))).toEqual(['Zwiebel', 'Tomaten']);
  });

  it('nutzt bei mehrteiligen Namen das Hauptwort und ignoriert Füllwörter', () => {
    const l = [ing('rote Zwiebel', 1, 'Stk'), ing('frische gehackte Petersilie', 1, 'Bund'), ing('1 Prise Salz')];
    expect(names(stepIngredientsFor('Zwiebeln anschwitzen, mit Salz würzen und Petersilie darüberstreuen.', l)))
      .toEqual(['rote Zwiebel', 'frische gehackte Petersilie', '1 Prise Salz']);
  });

  it('beachtet Umlaute und Beugung (Äpfel, Apfel, Öl)', () => {
    const l = [ing('Apfel', 2, 'Stk'), ing('Öl', 1, 'EL')];
    expect(names(stepIngredientsFor('Äpfel schälen. Etwas Öl erhitzen.', l))).toEqual(['Apfel', 'Öl']);
  });

  it('versteht Zutaten im Plural gegen Singular im Text', () => {
    expect(names(stepIngredientsFor('Die Kartoffel schälen.', [ing('Kartoffeln', 500)]))).toEqual(['Kartoffeln']);
  });

  it('trennt "Salz und Pfeffer" in zwei Suchbegriffe', () => {
    expect(names(stepIngredientsFor('Mit Pfeffer abschmecken.', [ing('Salz und Pfeffer')]))).toEqual(['Salz und Pfeffer']);
  });

  it('liefert eine Zutat auch in mehreren Schritten', () => {
    const steps = ['Zwiebel würfeln.', 'Reis kochen.', 'Zwiebel und Reis mischen.'];
    const result = stepIngredientsByStep(steps, [ing('Zwiebel'), ing('Reis')]);
    expect(result.map(names)).toEqual([['Zwiebel'], ['Reis'], ['Zwiebel', 'Reis']]);
  });
});

describe('stepIngredientsFor (Englisch)', () => {
  const list = [ing('onion', 1, 'pc'), ing('olive oil', 2, 'tbsp'), ing('red onion'), ing('eggs', 2, 'pc'), ing('tomato', 3, 'pc')];

  it('findet Plural und Singular', () => {
    expect(names(stepIngredientsFor('Dice the onions and add the tomatoes.', list))).toEqual(['onion', 'red onion', 'tomato']);
  });

  it('findet olive oil über das Hauptwort oil', () => {
    expect(names(stepIngredientsFor('Heat the oil in a pan.', [ing('olive oil')]))).toEqual(['olive oil']);
  });

  it('findet egg gegen eggs und nicht Teilwörter', () => {
    expect(names(stepIngredientsFor('Crack one egg into the bowl.', [ing('eggs')]))).toEqual(['eggs']);
    expect(names(stepIngredientsFor('Add some eggplant.', [ing('egg')]))).toEqual([]);
  });

  it('findet tomatoes gegen tomato', () => {
    expect(names(stepIngredientsFor('Add the tomatoes.', [ing('tomato')]))).toEqual(['tomato']);
  });
});

describe('stepIngredientsFor (Grenzfälle)', () => {
  it('liefert leere Liste ohne Zutaten', () => {
    expect(stepIngredientsFor('Zwiebel würfeln.', [])).toEqual([]);
  });

  it('liefert leere Liste bei leerem Schritt', () => {
    expect(stepIngredientsFor('', [ing('Zwiebel')])).toEqual([]);
    expect(stepIngredientsFor('   ', [ing('Zwiebel')])).toEqual([]);
  });

  it('ignoriert Zutaten ohne Namen oder nur aus Füllwörtern', () => {
    expect(stepIngredientsFor('Etwas frische Zwiebel.', [ing(''), ing('etwas frisch')])).toEqual([]);
  });

  it('verändert die Eingabe nicht und liefert Originalobjekte', () => {
    const zwiebel = ing('Zwiebel');
    const input = [zwiebel];
    const result = stepIngredientsFor('Zwiebel würfeln.', input);
    expect(result[0]).toBe(zwiebel);
    expect(input).toEqual([zwiebel]);
  });

  it('ignoriert Klammern und Zusätze nach dem Komma', () => {
    expect(names(stepIngredientsFor('Die Butter schmelzen.', [ing('Butter (zimmerwarm), weich')]))).toEqual(['Butter (zimmerwarm), weich']);
  });
});
