import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { clearQueryParams, pickParam } from '../../core/navigation/query-params';
import { SpoonacularProvider } from '../../core/recipes/online/spoonacular.provider';
import { toOnlineSearchError } from '../../core/recipes/online/spoonacular.errors';
import { RecipeSearchAccessService } from '../../core/recipes/online/recipe-search-access';
import { RecipeSearchConfigStore } from '../../core/state/recipe-search-config.store';

const STATUS_LABELS = {
  ownKey: 'Eigener Schlüssel aktiv',
  worker: 'Globaler Server aktiv',
  none: 'Nicht eingerichtet',
} as const;

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
  readonly access = inject(RecipeSearchAccessService);
  private readonly provider = inject(SpoonacularProvider);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly queryParams = toSignal(this.route.queryParamMap);

  readonly open = signal(false);
  readonly apiKey = signal(this.store.config().apiKey);
  readonly test = signal<TestState>({ busy: false, ok: null, message: null });
  readonly status = computed(() => STATUS_LABELS[this.access.mode()]);
  readonly isConnected = computed(() => this.access.isAvailable());
  /** Verbindungstest ist möglich, sobald irgendein Zugang besteht (eingetippter Key oder Worker). */
  readonly canTest = computed(() => this.apiKey().trim().length > 0 || this.access.mode() === 'worker');

  constructor() {
    effect(() => {
      if (pickParam(this.queryParams(), 'open', ['recipe-search']) !== 'recipe-search') return;
      untracked(() => this.openSheet());
      void clearQueryParams(this.router, ['open']);
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
    this.test.set({ busy: true, ok: null, message: 'Prüfe Verbindung…' });
    try {
      const left = await this.provider.ping({ apiKey: this.apiKey() });
      const quota = left === null ? '' : ` Noch ${left} Punkte heute.`;
      this.test.set({ busy: false, ok: true, message: `spoonacular ist erreichbar.${quota}` });
    } catch (e: unknown) {
      this.test.set({ busy: false, ok: false, message: toOnlineSearchError(e, false).message });
    }
  }
}
