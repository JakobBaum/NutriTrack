import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';

/**
 * Schlanke, wiederverwendbare SVG-Fortschrittsanzeige (Kreisring).
 * Kein Chart-Lib — nur zwei `circle`-Elemente (Track + Fortschritt).
 *
 * Projiziere Inhalt in die Mitte via Content-Projection:
 * `<app-progress-ring ...>42 %</app-progress-ring>`.
 */
@Component({
  selector: 'app-progress-ring',
  templateUrl: './progress-ring.component.html',
  styleUrls: ['./progress-ring.component.scss'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProgressRingComponent {
  /** Aktueller Wert (z.B. gegessene kcal). */
  readonly value = input<number>(0);
  /** Zielwert (z.B. Tagesziel kcal). 0 => Ring bleibt leer. */
  readonly max = input<number>(0);
  /** Strichfarbe des Fortschritts. */
  readonly color = input<string>('var(--nt-kcal)');
  /** Kantenlänge des Rings in px. */
  readonly size = input<number>(72);
  /** Strichstärke in px. */
  readonly stroke = input<number>(8);
  /** Farbe des ungefüllten Tracks. */
  readonly track = input<string>('var(--nt-track)');

  /** Anteil 0..1 (für die Darstellung auf max. 100 % begrenzt). */
  private readonly ratio = computed(() => {
    const max = this.max();
    if (max <= 0) return 0;
    return Math.min(1, Math.max(0, this.value() / max));
  });

  /** True, wenn der Wert das Ziel überschreitet (Warnfarbe). */
  readonly isOver = computed(() => this.max() > 0 && this.value() > this.max());

  readonly radius = computed(() => (this.size() - this.stroke()) / 2);
  readonly circumference = computed(() => 2 * Math.PI * this.radius());
  readonly center = computed(() => this.size() / 2);

  /** Rest-Umfang (ungefüllt) als dashoffset. */
  readonly dashOffset = computed(
    () => this.circumference() * (1 - this.ratio()),
  );

  /** Effektive Fortschrittsfarbe (Warnfarbe bei Überschreitung). */
  readonly strokeColor = computed(() =>
    this.isOver() ? 'var(--nt-over)' : this.color(),
  );
}
