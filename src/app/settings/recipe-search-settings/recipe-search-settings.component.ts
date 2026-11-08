import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { SpoonacularProvider } from '../../core/recipes/online/spoonacular.provider';
import { toOnlineSearchError } from '../../core/recipes/online/spoonacular.errors';
import { RecipeSearchConfigStore } from '../../core/state/recipe-search-config.store';

interface TestState {
  busy: boolean;
  ok: boolean | null;
  message: string | null;
}

/**
 * Abschnitt „Rezept-Suche“ im Profil: Zeile + Sheet mit dem spoonacular-Key
 * (maskiert) und „Verbindung testen“. Öffnet sich auch per `?open=recipe-search`.
 */
@Component({
  selector: 'app-recipe-search-settings',
  templateUrl: './recipe-search-settings.component.html',
  styleUrls: ['./recipe-search-settings.component.scss'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecipeSearchSettingsComponent {
  private readonly store = inject(RecipeSearchConfigStore);
  private readonly provider = inject(SpoonacularProvider);
  private readonly route = inject(ActivatedRoute);
  private readonly queryParams = toSignal(this.route.queryParamMap);

  readonly open = signal(false);
  readonly apiKey = signal(this.store.config().apiKey);
  readonly test = signal<TestState>({ busy: false, ok: null, message: null });
  readonly status = computed(() => (this.store.config().apiKey.trim() ? 'Verbunden' : 'Kein Schlüssel'));
  readonly isConnected = computed(() => this.store.config().apiKey.trim().length > 0);

  constructor() {
    effect(() => {
      if (this.queryParams()?.get('open') === 'recipe-search') this.openSheet();
    });
  }

  openSheet(): void {
    this.apiKey.set(this.store.config().apiKey);
    this.test.set({ busy: false, ok: null, message: null });
    this.open.set(true);
  }

  save(): void {
    this.store.setApiKey(this.apiKey());
    this.open.set(false);
  }

  /** Prüft den eingegebenen Key (auch ungespeichert) mit einer 1-Treffer-Anfrage ohne Zusatzdaten. */
  async testConnection(): Promise<void> {
    this.test.set({ busy: true, ok: null, message: 'Prüfe Verbindung …' });
    try {
      const left = await this.provider.ping({ apiKey: this.apiKey() });
      const quota = left === null ? '' : ` Noch ${left} Punkte heute.`;
      this.test.set({ busy: false, ok: true, message: `spoonacular ist erreichbar.${quota}` });
    } catch (e: unknown) {
      this.test.set({ busy: false, ok: false, message: toOnlineSearchError(e, false).message });
    }
  }
}
