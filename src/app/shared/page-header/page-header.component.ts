import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Gemeinsamer Seitenkopf: großer Titel links, Aktionen (per Inhalt) rechts. Layout und Sicherheitsabstände
 * kommen aus `.nt-page-header` in global.scss, damit alle Tabs gleich aussehen.
 */
@Component({
  selector: 'nt-page-header',
  template: `<div class="nt-page-header">
    <h1 class="nt-large-title">{{ title() }}</h1>
    <ng-content></ng-content>
  </div>`,
  styles: [':host { display: block; }'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NtPageHeaderComponent {
  readonly title = input.required<string>();
}
