import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
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

  async open(recipe: WeekPlanRecipe): Promise<void> {
    const modal = await this.modals.create({
      component: WeekRecipeSheetComponent,
      componentProps: { recipe, persons: this.plan()?.persons ?? recipe.portions },
      breakpoints: SHEET_BREAKPOINTS,
      initialBreakpoint: SHEET_INITIAL_BREAKPOINT,
      handle: true,
    });
    await modal.present();
  }
}
