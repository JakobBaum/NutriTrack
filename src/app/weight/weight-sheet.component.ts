import { ChangeDetectionStrategy, Component, OnChanges, SimpleChanges, inject, input, output, signal } from '@angular/core';
import { ProfileStore } from '../core/state/profile.store';
import { WRITE_BLOCKED_MESSAGE } from '../core/storage/storage-messages';
import { WeightStore } from '../core/state/weight.store';
import { toDateISO } from '../core/util/date';
import { MAX_WEIGHT_KG, MIN_WEIGHT_KG, isValidWeight } from '../core/weight/weight-math';
import { lightHaptic } from '../diary/haptics';

const DEFAULT_START_KG = 75;
const STEP_KG = 0.1;
const INVALID_WEIGHT_MESSAGE = `Bitte gib ein Gewicht zwischen ${MIN_WEIGHT_KG} und ${MAX_WEIGHT_KG} kg ein.`;

/** Sheet "Gewicht eintragen" (ein Eintrag je Tag); genutzt von der Gewichtskarte im Profil und der Kachel auf Heute. */
@Component({
  selector: 'app-weight-sheet',
  templateUrl: './weight-sheet.component.html',
  styleUrls: ['./weight-card.component.scss'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WeightSheetComponent implements OnChanges {
  private readonly weights = inject(WeightStore);
  private readonly profile = inject(ProfileStore);

  readonly isOpen = input(false);
  readonly closed = output<void>();

  readonly minKg = MIN_WEIGHT_KG;
  readonly maxKg = MAX_WEIGHT_KG;
  readonly stepKg = STEP_KG;
  readonly draftKg = signal<number>(DEFAULT_START_KG);
  /** Fehlermeldung, wenn das Speichern nicht möglich war (Schreibsperre). */
  readonly saveError = signal<string | null>(null);

  /** Heute schon eingetragen: Speichern ersetzt den Wert. */
  todayKg(): number | null {
    return this.weights.entries().find((e) => e.dateISO === toDateISO())?.kg ?? null;
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isOpen']?.currentValue === true) {
      this.saveError.set(null);
      this.draftKg.set(this.todayKg() ?? this.weights.latest()?.kg ?? this.profile.profile()?.weightKg ?? DEFAULT_START_KG);
    }
  }

  setDraft(kg: number): void {
    this.draftKg.set(kg);
  }

  save(): void {
    if (this.weights.isReadOnly()) {
      this.saveError.set(WRITE_BLOCKED_MESSAGE);
      return;
    }
    if (!isValidWeight(this.draftKg())) {
      this.saveError.set(INVALID_WEIGHT_MESSAGE);
      return;
    }
    this.saveError.set(null);
    if (!this.weights.set(toDateISO(), this.draftKg())) {
      this.saveError.set(WRITE_BLOCKED_MESSAGE);
      return;
    }
    lightHaptic();
    this.closed.emit();
  }
}
