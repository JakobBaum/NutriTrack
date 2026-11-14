import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { WeightStore } from '../core/state/weight.store';
import { toDateISO } from '../core/util/date';

/** Kompakte Gewichtskachel auf Heute (erscheint erst nach dem ersten Eintrag des Tages); öffnet das Gewichts-Sheet. */
@Component({
  selector: 'app-weight-tile',
  template: `
    <button type="button" class="nt-card weight-tile" data-testid="weight-tile" (click)="sheetOpen.set(true)" [attr.aria-label]="ariaLabel()">
      <span class="weight-tile__label">Gewicht</span>
      <span class="weight-tile__value">
        @if (latest(); as l) { <strong>{{ l.kg | ntNum:1 }}</strong> kg } @else { noch kein Wert }
      </span>
      <span class="weight-tile__action">{{ hasToday() ? 'Ändern' : 'Heute eintragen' }}</span>
    </button>
    <app-weight-sheet [isOpen]="sheetOpen()" (closed)="sheetOpen.set(false)"></app-weight-sheet>
  `,
  styles: [`
    :host { display: block; }
    .weight-tile { display: flex; align-items: center; gap: var(--nt-space-3); width: 100%; min-height: var(--nt-touch); border: 0; font: inherit; text-align: left; cursor: pointer; color: var(--nt-ink); }
    .weight-tile:focus-visible { outline: 2px solid var(--nt-focus); outline-offset: 2px; }
    .weight-tile__label { font-weight: 600; }
    .weight-tile__value { flex: 1; color: var(--nt-secondary); font-variant-numeric: tabular-nums; }
    .weight-tile__value strong { color: var(--nt-ink); }
    .weight-tile__action { font-weight: 600; color: var(--nt-accent-on-tint, var(--nt-accent)); }
  `],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WeightTileComponent {
  private readonly weights = inject(WeightStore);

  readonly sheetOpen = signal(false);
  readonly latest = this.weights.latest;
  readonly hasToday = computed(() => this.weights.entries().some((e) => e.dateISO === toDateISO()));
  readonly ariaLabel = computed(() => (this.hasToday() ? 'Gewicht von heute ändern' : 'Gewicht heute eintragen'));
}
