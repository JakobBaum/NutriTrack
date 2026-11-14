import { describe, expect, it } from 'vitest';
import { utensilsFor } from './utensils';

describe('utensilsFor', () => {
  it('liefert leere Liste ohne Schritte oder ohne Treffer', () => {
    expect(utensilsFor([])).toEqual([]);
    expect(utensilsFor(['', '  '])).toEqual([]);
    expect(utensilsFor(['Alles gut servieren.'])).toEqual([]);
  });

  it('erkennt Geräte direkt am Namen (Deutsch)', () => {
    const steps = ['Zwiebeln in einer großen Pfanne anbraten.', 'Im Topf Wasser erhitzen.', 'Auf ein Backblech legen.'];
    expect(utensilsFor(steps)).toEqual(['Topf', 'Pfanne', 'Backblech']);
  });

  it('erkennt Geräte direkt am Namen (Englisch)', () => {
    const steps = ['Heat a skillet over medium heat.', 'Boil water in a saucepan.', 'Place on a baking sheet.'];
    expect(utensilsFor(steps)).toEqual(['Topf', 'Pfanne', 'Backblech']);
  });

  it('leitet Geräte aus Verben ab', () => {
    expect(utensilsFor(['30 Minuten backen.'])).toEqual(['Backofen']);
    expect(utensilsFor(['Bake for 25 minutes.'])).toEqual(['Backofen']);
    expect(utensilsFor(['Die Suppe pürieren.'])).toEqual(['Mixer oder Pürierstab']);
    expect(utensilsFor(['Blend until smooth.'])).toEqual(['Mixer oder Pürierstab']);
    expect(utensilsFor(['Nudeln abgießen.'])).toEqual(['Sieb']);
    expect(utensilsFor(['Drain the pasta.'])).toEqual(['Sieb']);
    expect(utensilsFor(['Käse reiben.'])).toEqual(['Reibe']);
    expect(utensilsFor(['Eiweiß steif schlagen.'])).toEqual(['Schneebesen']);
    expect(utensilsFor(['Zwiebeln würfeln.'])).toEqual(['Messer und Schneidebrett']);
  });

  it('dedupliziert und ordnet sinnvoll (Vorbereitung vor Kochen vor Backen)', () => {
    const steps = ['Ofen auf 200 °C vorheizen.', 'Zwiebel hacken, in der Pfanne braten.', 'Pfanne vom Herd nehmen.', 'Im Backofen 20 Minuten backen.'];
    expect(utensilsFor(steps)).toEqual(['Messer und Schneidebrett', 'Pfanne', 'Backofen']);
  });

  it('verwechselt Backpulver, Topfen und Pfannkuchen nicht mit Geräten', () => {
    expect(utensilsFor(['Mehl mit Backpulver mischen, Topfen und Pfannkuchen-Teig bereithalten.'])).toEqual([]);
    expect(utensilsFor(['Add baking powder and baking soda.'])).toEqual([]);
  });

  it('erkennt Backform und Backpapier, Pan nur ohne baking davor', () => {
    expect(utensilsFor(['Springform mit Backpapier auslegen.'])).toEqual(['Backpapier', 'Backform']);
    expect(utensilsFor(['Grease a baking pan and line with parchment.'])).toEqual(['Backpapier', 'Backform']);
  });

  it('erkennt weitere Geräte', () => {
    const steps = ['Alles in der Mikrowelle erwärmen.', 'Im Wok garen.', 'Auf dem Grill garen.', 'Auf der Küchenwaage abwiegen.', 'Mit dem Schneebesen verrühren.'];
    expect(utensilsFor(steps)).toEqual(['Küchenwaage', 'Schneebesen', 'Wok', 'Grill', 'Mikrowelle']);
  });

  it('erkennt Umlaute im Namen (Schüssel)', () => {
    expect(utensilsFor(['In einer Schüssel vermengen.'])).toEqual(['Schüssel']);
  });
});
