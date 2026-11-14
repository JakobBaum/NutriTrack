import { HEALTH_NOTES } from '../../core/messages/health-notes';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActionSheetController } from '@ionic/angular';
import { ModalController } from '@ionic/angular/lazy';
import { WeekPlanStore } from '../../core/state/week-plan.store';
import { WeekPlanRecipe } from '../../core/week-plan/week-plan.model';
import { WeekPlanService } from '../../core/week-plan/week-plan.service';
import { groupByMeal, recipeMetaLine } from './week-plan-format';
import { WeekRecipeSheetComponent } from './week-recipe-sheet.component';

/** Breakpoints des Rezept-Sheets (0 = schließen). */
const SHEET_BREAKPOINTS = [0, 0.8, 1];
const SHEET_INITIAL_BREAKPOINT = 0.8;

/** Rezeptkarten des Wochenplans, nach Mahlzeit gruppiert; Tippen öffnet das Rezept-Sheet. */
@Component({
  selector: 'app-week-plan-cards',
  templateUrl: './week-plan-cards.component.html',
  styleUrls: ['./week-plan-cards.component.scss'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WeekPlanCardsComponent {
  private readonly store = inject(WeekPlanStore);
  private readonly modals = inject(ModalController);
  private readonly service = inject(WeekPlanService);
  private readonly actionSheet = inject(ActionSheetController);
  /** Rezept, dessen Ersatz gerade geladen wird (sonst null). */
  protected readonly nameFilterNote = HEALTH_NOTES.nameFilter;
  protected readonly busyId = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);

  /** "Übersetze Rezepte (n/m)" während der Übersetzung, sonst null. */
  readonly progress = this.service.translateProgress;
  /** Anzahl Rezepte, die nicht übersetzt werden konnten (Hinweis in der Liste). */
  readonly untranslated = computed(() => (this.plan()?.recipes ?? []).filter((r) => r.lang === 'en').length);

  constructor() {
    void this.service.ensureTranslated();
  }

  readonly plan = this.store.plan;
  readonly groups = computed(() => groupByMeal(this.plan()?.recipes ?? []));

  /** „Erneut übersetzen“ nach einem Fehlschlag (hebt die Sitzungssperre auf). */
  retryTranslation(): void {
    void this.service.retryTranslation();
  }

  meta(recipe: WeekPlanRecipe): string {
    return recipeMetaLine(recipe);
  }

  /** Menü je Rezept: tauschen oder entfernen, jeweils nur diese Woche oder „nie wieder vorschlagen“. */
  async openMenu(recipe: WeekPlanRecipe): Promise<void> {
    const sheet = await this.actionSheet.create({
      header: recipe.title,
      buttons: [
        { text: 'Anderes Rezept laden', data: { act: 'replace', never: false } },
        { text: 'Anderes laden, dieses nie wieder', data: { act: 'replace', never: true } },
        { text: 'Aus dem Plan entfernen', role: 'destructive', data: { act: 'remove', never: false } },
        { text: 'Entfernen und nie wieder vorschlagen', role: 'destructive', data: { act: 'remove', never: true } },
        { text: 'Abbrechen', role: 'cancel' },
      ],
    });
    await sheet.present();
    const { data } = await sheet.onDidDismiss<{ act: 'replace' | 'remove'; never: boolean }>();
    if (!data) return;
    this.error.set(null);
    if (data.act === 'remove') {
      this.service.removeRecipe(recipe.id, data.never);
      return;
    }
    this.busyId.set(recipe.id);
    try {
      await this.service.replaceRecipe(recipe.id, data.never);
    } catch (e: unknown) {
      this.error.set(e instanceof Error ? e.message : 'Rezept konnte nicht getauscht werden.');
    } finally {
      this.busyId.set(null);
    }
  }

  private isOpening = false;

  async open(recipe: WeekPlanRecipe): Promise<void> {
    // Doppel-Tipp: sonst lagen zwei Sheets uebereinander.
    if (this.isOpening) return;
    this.isOpening = true;
    try {
      const modal = await this.modals.create({
        component: WeekRecipeSheetComponent,
        componentProps: { recipe, persons: this.plan()?.persons ?? recipe.portions },
        breakpoints: SHEET_BREAKPOINTS,
        initialBreakpoint: SHEET_INITIAL_BREAKPOINT,
        handle: true,
      });
      await modal.present();
    } finally {
      this.isOpening = false;
    }
  }
}
