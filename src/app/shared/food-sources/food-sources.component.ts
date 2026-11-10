import {
  ChangeDetectionStrategy, Component, ViewChild, inject, input, output, signal,
} from '@angular/core';
import { FoodItem, NutritionFacts } from '../../core/models';
import { AiService } from '../../core/ai/ai.service';
import { BarcodeScannerService } from '../../core/scan/barcode-scanner.service';
import { CameraService } from '../../core/scan/camera.service';
import { LabelOcrService } from '../../core/scan/label-ocr.service';
import { blankFieldsFor, readLabelOffline } from '../../core/scan/label-scan';
import { shrinkPhotoForUpload } from '../../core/scan/label-image';
import { NtFoodSearchComponent } from '../food-search/food-search.component';
import type { BarcodeHit } from '../barcode-scanner/barcode-scanner.component';

/** Einheitliches Ergebnis aller Quellen (Suche, Barcode, Etikett). */
export interface FoodSourceResult {
  source: 'search' | 'barcode' | 'label';
  name: string;
  brand?: string;
  /** Id des Lebensmittels (Suche/Barcode). */
  foodItemId?: string;
  /** Übliche Portion in g, falls bekannt. */
  servingG?: number;
  facts: NutritionFacts;
  /** Gelesener Barcode (nur bei `barcode`). */
  code?: string;
  /** Per KI erkannt (nur bei `label` mit aktiver KI). */
  isAi?: boolean;
  hint?: string;
  /** Beim Etikett nicht gelesene Makro-Felder (leer lassen statt 0). */
  blankFields?: Partial<Record<'proteinG' | 'carbsG' | 'fatG', null>>;
}

const AI_LABEL_HINT = 'Werte pro 100 g erkannt — bitte mit dem Etikett vergleichen.';
const FILE_ERROR = 'Die Datei konnte nicht gelesen werden — wähle sie erneut aus.';
const CAMERA_ERROR = 'Kamera nicht verfügbar — nutze die Suche oder trage manuell ein.';
export const SLOW_AI_HINT_MS = 8000;
export const STATUS_PREPARING = 'Foto wird vorbereitet…';
export const STATUS_READING = 'KI liest das Etikett…';
export const STATUS_SLOW = 'Das dauert länger als sonst — die KI arbeitet noch…';
const LABEL_ERROR = 'Das Etikett konnte nicht gelesen werden — mach ein schärferes Foto oder trage manuell ein.';

function fromItem(item: FoodItem): Pick<FoodSourceResult, 'name' | 'brand' | 'facts' | 'foodItemId' | 'servingG'> {
  return { name: item.name, brand: item.brand, facts: item.facts, foodItemId: item.id, servingG: item.servingG };
}

/**
 * Gemeinsame Quellen für „Lebensmittel hinzufügen“: Suche + Kacheln Barcode / Etikett /
 * (eigene Kacheln per Inhalt) / Manuell. Liefert jede Quelle als `FoodSourceResult`.
 */
@Component({
  selector: 'nt-food-sources',
  templateUrl: './food-sources.component.html',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NtFoodSourcesComponent {
  private readonly ai = inject(AiService);
  private readonly camera = inject(CameraService);
  private readonly scanner = inject(BarcodeScannerService);
  private readonly labelOcr = inject(LabelOcrService);

  readonly placeholder = input('Lebensmittel suchen…');
  /** Ohne Suchbegriff die zuletzt genutzten eigenen Lebensmittel zeigen. */
  readonly showRecentCustom = input(false);
  /** Ein Lebensmittel wurde per Suche, Barcode oder Etikett ermittelt. */
  readonly result = output<FoodSourceResult>();
  /** „Manuell“ gewählt; Wert = aktueller Suchbegriff. */
  readonly manual = output<string>();
  /** Das Etikett war nicht lesbar (Meldung); die Quelle zeigt sie selbst inline. */
  readonly scanFailed = output<string>();

  protected readonly barcodeOpen = signal(false);
  protected readonly scanning = signal(false);
  /** Fortschrittstext während der Etikett-Erkennung (null, wenn nichts läuft). */
  protected readonly scanStatus = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);
  private readonly nativeCamera = this.camera.isNativeCameraAvailable();

  @ViewChild(NtFoodSearchComponent) private search?: NtFoodSearchComponent;

  get query(): string {
    return this.search?.query ?? '';
  }

  focus(): void {
    this.search?.focus();
  }

  reset(): void {
    this.search?.reset();
    this.error.set(null);
  }

  protected onPicked(item: FoodItem): void {
    this.result.emit({ source: 'search', ...fromItem(item) });
  }

  protected onManual(): void {
    this.manual.emit(this.query.trim());
  }

  protected openBarcode(): void {
    this.error.set(null);
    this.scanner.preload();
    this.barcodeOpen.set(true);
  }

  protected onBarcode(hit: BarcodeHit): void {
    this.barcodeOpen.set(false);
    this.result.emit({ source: 'barcode', ...fromItem(hit.item), code: hit.code });
  }

  protected startLabelScan(fileInput: HTMLInputElement): void {
    if (this.nativeCamera) {
      void this.run(() => this.camera.takePhotoBase64(), CAMERA_ERROR);
      return;
    }
    fileInput.click();
  }

  protected async onLabelFile(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    await this.run(() => this.fileToBase64(file), LABEL_ERROR);
    input.value = '';
  }

  private async run(getImage: () => Promise<string>, fallbackMessage: string): Promise<void> {
    this.error.set(null);
    this.scanning.set(true);
    this.scanStatus.set(STATUS_PREPARING);
    let slowTimer: ReturnType<typeof setTimeout> | undefined;
    try {
      const image = await getImage();
      slowTimer = setTimeout(() => this.scanStatus.set(STATUS_SLOW), SLOW_AI_HINT_MS);
      await this.recognize(image);
    } catch (e: unknown) {
      this.fail(e instanceof Error ? e.message : fallbackMessage);
    } finally {
      clearTimeout(slowTimer);
      this.scanning.set(false);
      this.scanStatus.set(null);
    }
  }

  /** Etikett lesen: mit KI per Vision, sonst On-Device-OCR. */
  private async recognize(base64: string): Promise<void> {
    if (this.ai.isLive()) {
      const small = await this.shrink(base64);
      this.scanStatus.set(STATUS_READING);
      const res = await this.ai.recognizeLabel(small, 'per100g');
      this.result.emit({ source: 'label', name: res.name, facts: res.facts, isAi: true, hint: AI_LABEL_HINT });
      return;
    }
    const out = await readLabelOffline(this.labelOcr, base64);
    if (!out.ok) {
      this.fail(out.message);
      return;
    }
    this.result.emit({
      source: 'label', name: '', facts: out.facts, hint: out.hint, blankFields: blankFieldsFor(out.missing),
    });
  }

  /** Foto vor dem KI-Upload verkleinern (in Tests ersetzbar). */
  protected shrink(base64: string): Promise<string> {
    return shrinkPhotoForUpload(base64);
  }

  private fail(message: string): void {
    this.error.set(message);
    this.scanFailed.emit(message);
  }

  private fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = String(reader.result);
        resolve(result.includes(',') ? result.split(',')[1] : result);
      };
      reader.onerror = () => reject(new Error(FILE_ERROR));
      reader.readAsDataURL(file);
    });
  }
}
