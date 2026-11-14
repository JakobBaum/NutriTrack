/** Quellen und Lizenzen für die Ansicht "Quellen und Lizenzen" (Daten statt Template). */

export interface DataSource {
  readonly name: string;
  readonly url: string;
  /** Lizenz bzw. Nutzungsbedingungen, wie vom Anbieter angegeben. */
  readonly license: string;
  readonly note: string;
}

export interface LibraryEntry {
  readonly name: string;
  /** Lizenz laut `license`-Feld der package.json im installierten Paket. */
  readonly license: string;
  readonly packages: string;
}

export const DATA_SOURCES: readonly DataSource[] = [
  {
    name: 'Open Food Facts',
    url: 'https://world.openfoodfacts.org',
    license: 'Open Database License (ODbL); Produktfotos CC BY-SA',
    note: 'Lebensmitteldaten und Barcodes, von Freiwilligen gepflegt.',
  },
  {
    name: 'Open Prices',
    url: 'https://prices.openfoodfacts.org',
    license: 'Open Database License (ODbL)',
    note: 'Von der Community gemeldete Supermarktpreise.',
  },
  {
    name: 'spoonacular',
    url: 'https://spoonacular.com',
    license: 'Nutzungsbedingungen von spoonacular',
    note: 'Rezeptdaten von spoonacular.com.',
  },
  {
    name: 'Google Gemini',
    url: 'https://ai.google.dev',
    license: 'Nutzungsbedingungen der Gemini API',
    note: 'KI-Funktionen. Ergebnisse sind Schätzungen.',
  },
];

export const LIBRARIES: readonly LibraryEntry[] = [
  { name: 'Angular', license: 'MIT', packages: '@angular/common, compiler, core, forms, platform-browser, platform-browser-dynamic, router' },
  { name: 'Ionic Framework und Ionicons', license: 'MIT', packages: '@ionic/angular, ionicons' },
  { name: 'Capacitor', license: 'MIT', packages: '@capacitor/core, android, ios, app, camera, haptics, keyboard, status-bar' },
  { name: 'Tesseract.js', license: 'Apache-2.0', packages: 'tesseract.js' },
  { name: 'Tesseract-Sprachdaten (Deutsch, Englisch)', license: 'MIT', packages: '@tesseract.js-data/deu, @tesseract.js-data/eng' },
  { name: 'ZXing Browser', license: 'MIT', packages: '@zxing/browser' },
  { name: 'ZXing Library', license: 'Apache-2.0', packages: '@zxing/library' },
  { name: 'RxJS', license: 'Apache-2.0', packages: 'rxjs' },
  { name: 'tslib', license: '0BSD', packages: 'tslib' },
];
