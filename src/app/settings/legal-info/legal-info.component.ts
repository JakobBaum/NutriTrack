import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { DATA_SOURCES, LIBRARIES } from '../sources-data';

/** Rechtstexte der Einstellungen: Datenschutz, Nutzungsbedingungen, Quellen und Lizenzen. */
@Component({
  selector: 'app-legal-info',
  templateUrl: './legal-info.component.html',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LegalInfoComponent {
  readonly section = input.required<'datenschutz' | 'agb' | 'quellen'>();
  readonly dataSources = DATA_SOURCES;
  readonly libraries = LIBRARIES;
}
