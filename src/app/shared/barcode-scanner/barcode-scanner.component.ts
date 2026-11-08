import {
  ChangeDetectionStrategy, Component, ElementRef, OnDestroy, ViewChild, inject, input, output, signal,
} from '@angular/core';
import type { IScannerControls } from '@zxing/browser';
import { FoodItem } from '../../core/models';
import { FOOD_PROVIDER } from '../../core/food/food-provider';
import { foodErrorMessage } from '../../core/food/food-errors';
import { BarcodeScannerService } from '../../core/scan/barcode-scanner.service';

/** Ein Treffer des Barcode-Scanners: Produkt samt gelesenem Code. */
export interface BarcodeHit {
  item: FoodItem;
  code: string;
}

/**
 * Vollbild-Barcode-Scanner (Kamera-Live-Scan mit Fallback auf Code-Eingabe).
 * Öffnet sich über `open`; meldet Treffer über `found` und das Schließen über `closed`.
 */
@Component({
  selector: 'nt-barcode-scanner',
  templateUrl: './barcode-scanner.component.html',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NtBarcodeScannerComponent implements OnDestroy {
  private readonly food = inject(FOOD_PROVIDER);
  private readonly scanner = inject(BarcodeScannerService);

  readonly open = input(false);
  readonly found = output<BarcodeHit>();
  readonly closed = output<void>();

  protected readonly error = signal<string | null>(null);
  protected readonly looking = signal(false);
  protected readonly manualOpen = signal(false);
  /** True, wenn keine Kamera nutzbar ist (Rahmen/Anleitung weg, Code-Eingabe offen). */
  protected readonly noCamera = signal(false);
  protected manualCode = '';

  private controls?: IScannerControls;

  @ViewChild('barcodeVideo') private video?: ElementRef<HTMLVideoElement>;

  ngOnDestroy(): void {
    this.stop();
  }

  /** ion-modal willPresent: Zustand zurücksetzen. */
  protected onWillPresent(): void {
    this.manualCode = '';
    this.error.set(null);
    this.looking.set(false);
    this.manualOpen.set(false);
    this.noCamera.set(false);
  }

  /** ion-modal didPresent → Live-Scan starten, sofern der Browser es kann. */
  protected async onPresent(): Promise<void> {
    const video =
      this.video?.nativeElement ?? (document.querySelector('video#ntBarcodeVideo') as HTMLVideoElement | null);
    if (!video || !this.scanner.isSupported()) {
      this.showWithoutCamera();
      return;
    }
    try {
      this.controls = await this.scanner.start(
        video,
        (code) => void this.lookup(code),
        () => this.showWithoutCamera('Kamerazugriff fehlgeschlagen — gib den Code manuell ein.'),
      );
    } catch {
      this.showWithoutCamera('Kamera nicht verfügbar — gib den Code manuell ein.');
    }
  }

  /** ion-modal didDismiss → Kamera freigeben und Schließen melden. */
  protected onDismiss(): void {
    this.stop();
    this.closed.emit();
  }

  protected toggleManual(): void {
    this.manualOpen.update((v) => !v);
  }

  protected submitManual(): void {
    const code = this.manualCode.trim();
    if (code) void this.lookup(code);
  }

  private showWithoutCamera(message?: string): void {
    this.noCamera.set(true);
    this.manualOpen.set(true);
    if (message) this.error.set(message);
  }

  private stop(): void {
    this.controls?.stop();
    this.controls = undefined;
  }

  private async lookup(code: string): Promise<void> {
    if (this.looking()) return;
    this.stop();
    this.error.set(null);
    this.looking.set(true);
    try {
      const item = await this.food.lookupByBarcode(code);
      if (!item) {
        this.error.set(`Kein Produkt zu Barcode ${code} gefunden — prüfe die Ziffern oder suche per Name.`);
        return;
      }
      this.found.emit({ item, code });
    } catch (e: unknown) {
      this.error.set(foodErrorMessage(e));
    } finally {
      this.looking.set(false);
    }
  }
}
