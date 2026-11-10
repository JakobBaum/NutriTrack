import {
  ChangeDetectionStrategy, Component, ElementRef, OnDestroy, ViewChild, inject, input, output, signal,
} from '@angular/core';
import type { IScannerControls } from '@zxing/browser';
import { FoodItem } from '../../core/models';
import { FOOD_PROVIDER } from '../../core/food/food-provider';
import { foodErrorMessage } from '../../core/food/food-errors';
import { BarcodeScannerService } from '../../core/scan/barcode-scanner.service';

/** Pause vor dem erneuten Scan nach Fehlschlag, damit derselbe Code nicht sofort wieder abgefragt wird. */
export const RESCAN_DELAY_MS = 1500;

/** Obergrenze (Frames) für das Warten, bis Ionic das geschlossene Modal wirklich als beendet führt. */
export const OVERLAY_MAX_WAIT_FRAMES = 60;

/** Ein Treffer des Barcode-Scanners: Produkt samt gelesenem Code. */
export interface BarcodeHit {
  item: FoodItem;
  code: string;
}

/**
 * Vollbild-Barcode-Scanner (Kamera-Live-Scan mit Fallback auf Code-Eingabe).
 * Öffnet sich über `open`; meldet Treffer über `found` und das Schließen über `closed`.
 * Ein Treffer wird erst gemeldet, wenn das Modal ganz geschlossen ist: Der Eltern-View wechselt
 * dann auf das Formular und zerstört diese Komponente; ein dabei halb geschlossenes Modal ließ
 * die Seite abstürzen bzw. hängen.
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
  private presented = false;
  private starting = false;
  private pendingHit: BarcodeHit | null = null;
  private rescanTimer?: ReturnType<typeof setTimeout>;

  @ViewChild('scannerModal') private modal?: { dismiss(): Promise<boolean> };
  @ViewChild('barcodeVideo') private video?: ElementRef<HTMLVideoElement>;

  ngOnDestroy(): void {
    this.stop();
  }

  /** ion-modal willPresent: Zustand zurücksetzen und die Kamera schon während der Einblend-Animation starten. */
  protected onWillPresent(): void {
    this.manualCode = '';
    this.error.set(null);
    this.looking.set(false);
    this.manualOpen.set(false);
    this.noCamera.set(false);
    this.pendingHit = null;
    this.presented = true;
    setTimeout(() => void this.startScan(true));
  }

  /** ion-modal didPresent → Live-Scan starten, falls der frühe Start noch kein Video-Element fand. */
  protected async onPresent(): Promise<void> {
    this.presented = true;
    await this.startScan();
  }

  private findVideo(): HTMLVideoElement | null {
    return this.video?.nativeElement ?? (document.querySelector('video#ntBarcodeVideo') as HTMLVideoElement | null);
  }

  /** `early`: noch vor didPresent; fehlt das Video-Element, wird still abgewartet statt "keine Kamera" gemeldet. */
  private async startScan(early = false): Promise<void> {
    if (this.controls || this.starting) return;
    const video = this.findVideo();
    if (!video && early) return;
    if (!video || !this.scanner.isSupported()) {
      this.showWithoutCamera();
      return;
    }
    this.starting = true;
    try {
      this.controls = await this.scanner.start(
        video,
        (code) => void this.lookup(code),
        () => this.showWithoutCamera('Kamerazugriff fehlgeschlagen — gib den Code manuell ein.'),
      );
    } catch {
      this.showWithoutCamera('Kamera nicht verfügbar — gib den Code manuell ein.');
    } finally {
      this.starting = false;
    }
  }

  /** ion-modal didDismiss → Kamera freigeben, Schließen melden, danach den wartenden Treffer. */
  protected onDismiss(): void {
    this.presented = false;
    this.stop();
    const hit = this.pendingHit;
    this.pendingHit = null;
    this.closed.emit();
    if (hit) void this.whenOverlayGone().then(() => this.found.emit(hit));
  }

  /**
   * Ionic führt das Modal noch kurz als präsentiert (Klasse `show-modal`), obwohl didDismiss schon kam. Fokussiert der
   * Eltern-View in dieser Zeit ein Feld, ziehen Fokusfalle des Scanners und des Sheets den Fokus endlos hin und her
   * (Seite stürzt ab). Darum erst melden, wenn die Klasse weg ist.
   */
  private async whenOverlayGone(): Promise<void> {
    const el = (this.modal as { el?: HTMLElement } | undefined)?.el;
    for (let frame = 0; el?.classList.contains('show-modal') && frame < OVERLAY_MAX_WAIT_FRAMES; frame++) {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    }
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
    clearTimeout(this.rescanTimer);
    this.controls?.stop();
    this.controls = undefined;
  }

  /** Nach Fehlschlag (nicht gefunden / Fehler) die Kamera wieder starten, solange der Scanner offen ist. */
  private scheduleRescan(): void {
    if (!this.presented || this.noCamera()) return;
    this.rescanTimer = setTimeout(() => void this.startScan(), RESCAN_DELAY_MS);
  }

  /** Modal erst schließen, dann melden (siehe Klassenkommentar). Ohne Modal (Tests) sofort melden. */
  private async finishWith(hit: BarcodeHit): Promise<void> {
    if (!this.modal) {
      this.found.emit(hit);
      return;
    }
    this.pendingHit = hit;
    await this.modal.dismiss();
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
        this.scheduleRescan();
        return;
      }
      await this.finishWith({ item, code });
    } catch (e: unknown) {
      this.error.set(foodErrorMessage(e));
      this.scheduleRescan();
    } finally {
      this.looking.set(false);
    }
  }
}
