import {
  ChangeDetectionStrategy,
  Component,
  OnChanges,
  SimpleChanges,
  ElementRef,
  ViewChild,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { ActionSheetController, ToastController } from '@ionic/angular';
import { AmountUnit, DiaryEntry, FoodItem, MealType, NutritionFacts, SavedMeal } from '../../core/models';
import { sourceAttribution } from '../../core/messages/source-attribution';
import { OpenPricesProvider } from '../../core/price/open-prices.provider';
import { StorageService } from '../../core/storage/storage.service';
import { WRITE_BLOCKED_MESSAGE, describeStorageError } from '../../core/storage/storage-messages';
import { DiaryStore, NewDiaryEntry } from '../../core/state/diary.store';
import { FavoriteFood, FavoriteStore, newEntryFromFavorite } from '../../core/state/favorite.store';
import { CustomFood, CustomFoodStore } from '../../core/state/custom-food.store';
import { MealsStore } from '../../core/state/meals.store';
import { RecipeStore } from '../../core/state/recipe.store';
import { OnlineRecipeDetailsService } from '../../core/recipes/online/online-recipe-details.service';
import { StoredRecipe, isOnlineRef } from '../../core/recipes/online/online-recipe-ref';
import { RecipeFactsLoader } from '../../meals/recipe-facts-loader';
import { countMissingFacts } from '../../recipes/recipe-view';
import { plausibleServingG } from '../../core/food/serving';
import { DescribeMealComponent } from '../describe-meal/describe-meal.component';
import { ensureWritable } from '../write-guard';
import { AmountRowComponent } from '../../shared/amount-row/amount-row.component';
import { FoodSourceResult, NtFoodSourcesComponent } from '../../shared/food-sources/food-sources.component';
import { AmountChip, StepDirection, amountChips, stepAmount, stepServings } from '../diary-edit';
import {
  AMOUNT_UNITS,
  EMPTY_FIELDS,
  EntryFields,
  MEAL_DEFS,
  baseUnitOf,
  convertAmount,
  factsDiffer,
  factsFromFields,
  fieldsFromFacts,
  formatAmount,
  fromBaseAmount,
  inputTextFor,
  isValidAmount,
  lastAmountFromIndex,
  buildLastAmountIndex,
  mealForHour,
  mealLabel,
  perServingFacts,
  rebaseTo100,
  scaleFacts,
  shouldRememberAsCustomFood,
  toBaseAmount,
  toNumberOrNull,
  unitForName,
} from '../diary-helpers';
import { confirmDiscardSheet } from '../diary-sheets';
import { lightHaptic } from '../haptics';
import { hasMacros, withDerivedKcal } from '../nutrient-fields';
import { clearRawTexts } from '../raw-texts';
import { showEntryToast } from '../entry-toast';
import {
  AddView,
  QuantityUnit,
  ScaleBase,
  EntryForm,
  ApplyOptions,
  EMPTY_FORM,
  DEFAULT_AMOUNT_G,
  MAX_RECENT_FOODS,
  SEARCH_FOCUS_DELAY_MS,
  QUICK_ADD_LOCK_MS,
  QUICK_ENTRY_LABEL,
  AMOUNT_FOCUS_DELAY_MS,
  ADJUST_SCROLL_DELAY_MS,
  ADD_FORM_TEXT_KEYS,
} from './add-entry-types';
import { PriceHint, priceHintText } from './price-hint';
import { dismissKeyboard } from '../../core/keyboard/dismiss-keyboard';
import { entryAddedMessage } from '../entry-message';
import {
  baseFactsForSave,
  checkAddForm,
  entriesFromSavedMeal,
  entryFromRecent,
  entryFromRecipe,
  NO_RECIPE_FACTS_MESSAGE,
  rebaseScaleBase,
  filterLoggableRecipes,
  isLoggableRecipe,
  recentLoggableRecipes,
  resolveAdjustOpen,
  AccordionChangeEvent,
  savedMealProtein,
  sumEntryTotals,
} from './add-entry-logic';

/**
 * Eintragen-Sheet: Suchen → Menge → Speichern. Wird vom Tagebuch und von „Heute“
 * geöffnet (Eingabe `isOpen`; beim Öffnen startet es in der Suche mit der Vorbelegung `meal`).
 * Schließen meldet `closed`; der Aufrufer setzt `isOpen` zurück.
 */
@Component({
  selector: 'app-add-entry-sheet',
  templateUrl: './add-entry-sheet.component.html',
  styleUrls: ['./add-entry-sheet.component.scss'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AddEntrySheetComponent implements OnChanges {
  private readonly diary = inject(DiaryStore);
  private readonly recipeStore = inject(RecipeStore);
  private readonly customFoods = inject(CustomFoodStore);
  private readonly mealsStore = inject(MealsStore);
  private readonly favoriteStore = inject(FavoriteStore);
  private readonly prices = inject(OpenPricesProvider);
  private readonly toastCtrl = inject(ToastController);
  private readonly sheetCtrl = inject(ActionSheetController);
  private readonly storage = inject(StorageService);
  /** Lädt Nährwerte gespeicherter Online-Verweise nach (Ladezustand, Fehler, Sequenz-Token). */
  readonly recipeLoad = new RecipeFactsLoader(inject(OnlineRecipeDetailsService));
  private retryQuick = false;

  /** Sheet offen. Wechsel auf true startet einen neuen Eintrag. */
  readonly isOpen = input(false);
  /** Mahlzeit, die beim Öffnen vorbelegt ist. */
  readonly meal = input<MealType>('breakfast');
  /** ISO-Tag, auf den der Eintrag gebucht wird. */
  readonly date = input.required<string>();
  /** Sheet wurde geschlossen (gespeichert, abgebrochen oder gewischt). */
  readonly closed = output<void>();

  @ViewChild(NtFoodSourcesComponent) foodSearch?: NtFoodSourcesComponent;
  @ViewChild(AmountRowComponent) amountRow?: AmountRowComponent;
  @ViewChild(DescribeMealComponent) describeMeal?: DescribeMealComponent;
  @ViewChild('adjustGroup', { read: ElementRef }) adjustGroup?: ElementRef<HTMLElement>;

  /** Roher Tipptext je Zahlenfeld (erhält z. B. "1," beim Tippen mit Komma). */
  private readonly rawTexts: Record<string, string> = {};

  readonly view = signal<AddView>('search');
  /** Gewählte Essenszeit (steuert "Zuletzt benutzt"); form.meal bleibt die Quelle fürs Speichern. */
  readonly selectedMeal = signal<MealType>('breakfast');
  /** Anzahl Schnell-Einträge in dieser Sitzung (Sheet bleibt offen; der Kopfknopf wird zu "Fertig"). */
  readonly addedCount = signal(0);
  /** Speicherfehler als Banner im Sheet (das globale Banner liegt hinter dem Sheet). */
  readonly storageError = computed(() => {
    const error = this.storage.lastError();
    return error ? describeStorageError(error) : null;
  });
  readonly error = signal<string | null>(null);
  /** Wert der Accordion-Gruppe „Nährwerte anpassen“ ('adjust' = offen). */
  readonly adjustOpen = signal<string | undefined>(undefined);
  /** True, wenn die Werte im Formular aus einer KI-Schätzung stammen. */
  readonly isAiEstimate = signal(false);
  private readonly hint = new PriceHint();
  readonly formHint = this.hint.text;
  /** Quellenangabe zu Open Food Facts / Open Prices (Lizenzpflicht), solange ein Treffer im Formular steht. */
  readonly sourceNote = signal<string | null>(null);
  /** Freitext-Filter für die Rezept-Auswahl. */
  readonly recipeQuery = signal('');
  /** Freitext-Filter für gespeicherte (eigene) Lebensmittel. */
  readonly customQuery = signal('');

  /** True, wenn die Rezeptwerte unvollständig sind (Zutaten ohne Nährwerte). */
  private isPartialSource = false;
  form: EntryForm = { ...EMPTY_FORM };
  /** True, sobald etwas getippt wurde (dann fragt das Schließen „Verwerfen?“). */
  private addDirty = false;
  /** kcal selbst eingegeben (true) oder aus den Makros berechnet (false). */
  kcalManual = false;
  /** Gewähltes Rezept (für die ref des Eintrags), null bei manuell/Food. */
  private pickedRecipeId: string | null = null;
  /** Marke des gewählten Suchtreffers (nur Anzeige), sonst undefined. */
  private pickedBrand: string | undefined;
  /** Packungsportion (g/ml) des gewählten Treffers, falls plausibel; sonst null. */
  private pickedServingG: number | null = null;
  /** Bezugswerte für die Mengenskalierung; null bei manueller Eingabe. */
  scaleBase: ScaleBase | null = null;
  /** Gewählte Einheit der Mengeneingabe; form.amountG zeigt den Wert in dieser Einheit. */
  amountUnit: AmountUnit = 'g';
  /** True, wenn von Hand geänderte Werte noch nicht zur Basis wurden (Menge oder kcal fehlten dabei). */
  private isBaseStale = false;
  /** True, sobald die Einheit manuell gewählt wurde (stoppt die Namens-Vorgabe). */
  private unitTouched = false;
  readonly formatAmount = formatAmount;

  readonly mealOptions: { value: MealType; label: string }[] = MEAL_DEFS.map((m) => ({
    value: m.type,
    label: m.label,
  }));

  readonly recipeOptions = computed(() => filterLoggableRecipes(this.recipeStore.recipes(), this.recipeQuery()));

  readonly hasLoggableRecipes = computed(() => this.recipeStore.recipes().some(isLoggableRecipe));

  readonly customFoodOptions = computed<CustomFood[]>(() => {
    const q = this.customQuery().trim().toLowerCase();
    const all = this.customFoods.foods();
    return q ? all.filter((f) => f.name.toLowerCase().includes(q)) : all;
  });

  readonly hasCustomFoods = computed(() => this.customFoods.foods().length > 0);

  /** Gespeicherte Mahlzeiten (Vorlagen aus dem Mahlzeiten-Tab). */
  readonly savedMeals = this.mealsStore.meals;
  readonly hasSavedMeals = computed(() => this.mealsStore.meals().length > 0);

  /** Zuletzt benutzte Lebensmittel. */
  readonly recentFoods = computed(() => this.diary.recentFoods(MAX_RECENT_FOODS, this.selectedMeal()));

  readonly recentRecipes = computed(() => recentLoggableRecipes(this.diary.recentRecipeIds(3), this.recipeStore.recipes()));

  /** Letzte Mengen je Name, nur bei geändertem Tagebuch neu aufgebaut (nicht bei jedem Tastendruck). */
  private readonly lastAmounts = computed(() => buildLastAmountIndex(this.diary.entries()));

  readonly canDismissAdd = (): Promise<boolean> => this.confirmAddClose();

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isOpen']?.currentValue === true) this.startEntry(this.meal());
  }

  /** Sperrt „Eintragen“ nach dem ersten Klick (kein doppelter Eintrag durch Doppeltippen). */
  private isSaving = false;
  /** True nach absichtlichem Schließen; canDismiss fragt dann nicht mehr (Reset beim nächsten Öffnen). */
  private skipCloseConfirm = false;

  /** Setzt Formular und Zustand für einen neuen Eintrag zurück. */
  private startEntry(meal: MealType): void {
    this.recipeLoad.cancel();
    this.isSaving = false;
    this.skipCloseConfirm = false;
    this.resetSource();
    this.form = { ...EMPTY_FORM, meal };
    this.selectedMeal.set(meal);
    this.addedCount.set(0);
    this.amountUnit = 'g';
    this.recipeQuery.set('');
    this.customQuery.set('');
    this.foodSearch?.reset();
    this.adjustOpen.set(undefined);
    this.view.set('search');
  }

  /** Setzt alles zurück, was von einer gewählten Quelle (Treffer, Rezept, manuell) stammt. */
  private resetSource(): void {
    this.addDirty = false;
    this.kcalManual = false;
    this.scaleBase = null;
    this.isBaseStale = false;
    this.pickedRecipeId = null;
    this.pickedBrand = undefined;
    this.pickedServingG = null;
    clearRawTexts(this.rawTexts, ADD_FORM_TEXT_KEYS);
    this.unitTouched = false;
    this.hint.set(null);
    this.sourceNote.set(null);
    this.isAiEstimate.set(false);
    this.isPartialSource = false;
    this.error.set(null);
  }

  /** Absichtliches Schließen (Erfolg oder bestätigtes Verwerfen): die Rückfrage des Modals entfällt bis zum nächsten Öffnen. */
  closeAdd(): void {
    this.recipeLoad.cancel();
    this.addDirty = false;
    this.skipCloseConfirm = true;
    this.closed.emit();
  }

  async requestCloseAdd(): Promise<void> {
    if (await this.confirmAddClose()) this.closeAdd();
  }

  private async confirmAddClose(): Promise<boolean> {
    return this.skipCloseConfirm || !this.hasUnsavedInput() || confirmDiscardSheet(this.sheetCtrl);
  }

  /** True, wenn im Formular oder in „Essen beschreiben“ etwas eingegeben wurde, das beim Verlassen verloren ginge. */
  private hasUnsavedInput(): boolean {
    return this.addDirty || (this.view() === 'describe' && !!this.describeMeal?.isDirty());
  }

  /** True, wenn Favoriten oder Zuletzt benutzt sichtbar sind (die Tastatur würde sie verdecken). */
  private hasQuickPicks(): boolean {
    return this.favoriteList().length > 0 || this.recentFoods().length > 0 || this.recentRecipes().length > 0;
  }

  /** Eingabetaste im Namensfeld: Tastatur schließen ("Fertig"). */
  readonly dismissKeyboard = dismissKeyboard;

  /** Essenszeit wählen (Chips oben). */
  setMeal(meal: MealType): void {
    this.form = { ...this.form, meal };
    this.selectedMeal.set(meal);
  }

  /** ion-modal didPresent → Suchfeld fokussieren, aber nur ohne Favoriten/Zuletzt (sonst verdeckt die Tastatur sie). */
  focusSearch(): void {
    if (this.hasQuickPicks()) return;
    setTimeout(() => this.foodSearch?.focus(), SEARCH_FOCUS_DELAY_MS);
  }

  showView(next: AddView): void {
    this.recipeLoad.cancel();
    this.error.set(null);
    this.view.set(next);
  }

  /** Zurück zur Suche (Suchtext und Treffer bleiben); fragt „Verwerfen?“, wenn schon etwas eingegeben wurde. */
  async backToSearch(): Promise<void> {
    if (this.hasUnsavedInput() && !(await confirmDiscardSheet(this.sheetCtrl))) return;
    this.resetSource();
    this.showView('search');
    this.focusSearch();
  }

  selectedMealLabel(): string {
    return mealLabel(this.form.meal);
  }

  modalTitle(): string {
    switch (this.view()) {
      case 'recipes': return 'Rezept wählen';
      case 'saved': return 'Eigene Lebensmittel';
      case 'meals': return 'Gespeicherte Mahlzeit';
      case 'describe': return 'Essen beschreiben';
      default: return `In ${this.selectedMealLabel()} eintragen`;
    }
  }

  // --- Formular ---
  get quantityUnit(): QuantityUnit | null {
    return this.scaleBase?.unit ?? null;
  }

  /** Basiseinheit der Quelle (Hinweis „kcal pro 100 g/ml“). */
  get baseUnit(): 'g' | 'ml' {
    return baseUnitOf(this.amountUnit);
  }

  /** Eingegebene Menge in Basiseinheit (g bzw. ml); null bei leerer/ungültiger Eingabe. */
  private get baseAmount(): number | null {
    const v = this.form.amountG;
    return v == null ? null : toBaseAmount(v, this.amountUnit);
  }

  /** Wechselt die Einheit und rechnet den gezeigten Wert um (Menge bleibt gleich). */
  setAmountUnit(unit: unknown): void {
    if (!AMOUNT_UNITS.includes(unit as AmountUnit) || unit === this.amountUnit) return;
    const next = unit as AmountUnit;
    // Ungerundet umrechnen, damit g -> kg -> g keine Kleinstmengen verliert.
    const v = this.form.amountG;
    this.form = { ...this.form, amountG: v == null ? null : convertAmount(v, this.amountUnit, next) };
    this.amountUnit = next;
    this.unitTouched = true;
  }

  /** Name geändert: bei manueller Eingabe die Einheit vorschlagen, solange nicht manuell gewählt. */
  setLabel(value: unknown): void {
    const label = typeof value === 'string' ? value : '';
    this.addDirty = true;
    this.form = { ...this.form, label };
    if (!this.scaleBase && !this.unitTouched) this.amountUnit = unitForName(label);
  }

  /** True, wenn das gewählte Rezept Zutaten ohne Nährwerte hat. */
  isPartialRecipe(): boolean {
    return this.isPartialSource;
  }

  /** kcal pro 100 g der gewählten Quelle (Hinweis unter der Mengeneingabe). */
  get basisKcal(): number | null {
    return this.scaleBase?.unit === 'g' ? this.scaleBase.facts.kcal : null;
  }

  /** Blendet das Formular für eine manuelle Eingabe ein; kcal sind Pflicht, daher offen. */
  openManualEntry(typed?: string): void {
    const label = typed ?? this.foodSearch?.query.trim() ?? '';
    this.resetSource();
    this.form = { ...this.form, ...EMPTY_FIELDS, label, amountG: null, servings: null };
    this.amountUnit = unitForName(label);
    this.adjustOpen.set('adjust');
    this.view.set('form');
    this.scrollAdjustIntoView();
  }

  /** Scrollt „Nährwerte anpassen“ nach dem Aufklappen an den oberen Rand, damit die Felder sichtbar sind. */
  private scrollAdjustIntoView(): void {
    setTimeout(() => this.adjustGroup?.nativeElement.scrollIntoView?.({ block: 'start', behavior: 'smooth' }), ADJUST_SCROLL_DELAY_MS);
  }

  /** Anzeigetext eines Zahlenfelds (Dezimalkomma, Tipptext bleibt erhalten). */
  numText(key: string, value: number | null): string {
    return inputTextFor(this.rawTexts[key], value);
  }

  /** Markiert beim Fokus den gesamten Feldinhalt, damit Tippen ihn ersetzt. */
  selectAllOnFocus(event: Event): void {
    const el = event.target as { getInputElement?: () => Promise<HTMLInputElement> } | null;
    void el?.getInputElement?.().then((input) => input.select());
  }

  /** Nährwert-Feld (kcal/Eiweiß/...) aus Texteingabe setzen. */
  setField(key: keyof EntryFields, value: unknown): void {
    this.rawTexts[key] = String(value ?? '');
    this.addDirty = true;
    if (key === 'kcal') this.kcalManual = true;
    const next = { ...this.form, [key]: toNumberOrNull(value) };
    const isMacro = key === 'proteinG' || key === 'carbsG' || key === 'fatG';
    this.form = isMacro && !this.kcalManual ? { ...next, ...withDerivedKcal(next) } : next;
    this.rebaseScaleBase();
  }

  /** Von Hand geänderte Werte werden zur neuen Basis, damit eine Mengenänderung sie mitnimmt statt zu überschreiben (T1). */
  private rebaseScaleBase(): void {
    const base = this.scaleBase;
    if (!base) return;
    const facts = factsFromFields(this.form);
    const next = facts ? rebaseScaleBase(facts, base.unit, this.baseAmount, this.form.servings) : null;
    // Ohne gültige Menge oder kcal bleibt die alte Basis veraltet; rescale() darf die Eingaben dann nicht überschreiben.
    this.isBaseStale = next === null;
    if (next) this.scaleBase = { ...base, facts: next };
  }

  /** Schalter „kcal selbst eingeben“; aus = kcal wieder aus den Makros berechnen. */
  setKcalManual(on: boolean): void {
    this.kcalManual = on;
    if (!on) this.form = { ...this.form, ...withDerivedKcal(this.form) };
  }

  /** True, wenn die kcal gerade aus den Makros berechnet angezeigt werden. */
  get kcalDerived(): boolean {
    return !this.kcalManual && hasMacros(this.form);
  }

  /** Chips der Mengenzeile (Vorgaben, „zuletzt“ nur wenn abweichend). */
  get addChips(): AmountChip[] {
    return amountChips(this.amountUnit, this.lastAmountFor(this.form.label, this.amountUnit), this.pickedServingG);
  }

  stepAddAmount(direction: StepDirection): void {
    delete this.rawTexts['amount'];
    this.setAmount(stepAmount(this.form.amountG, this.amountUnit, direction));
  }

  stepAddServings(direction: StepDirection): void {
    delete this.rawTexts['servings'];
    this.setServings(stepServings(this.form.servings, direction));
  }

  /** Letzte geloggte Menge (in aktueller Einheit) für das gewählte Lebensmittel, sonst null. */
  lastAmountFor(label: string, unit: AmountUnit): number | null {
    const amount = lastAmountFromIndex(this.lastAmounts(), label);
    return amount == null ? null : fromBaseAmount(amount, unit);
  }

  pickAmount(value: number): void {
    delete this.rawTexts['amount'];
    this.setAmount(value);
  }

  setAmount(value: unknown): void {
    this.addDirty = true;
    if (typeof value === 'string') this.rawTexts['amount'] = value;
    this.form = { ...this.form, amountG: toNumberOrNull(value) };
    this.rescale();
  }

  setServings(value: unknown): void {
    this.addDirty = true;
    if (typeof value === 'string') this.rawTexts['servings'] = value;
    this.form = { ...this.form, servings: toNumberOrNull(value) };
    this.rescale();
  }

  onAdjustChange(event: AccordionChangeEvent): void {
    const next = resolveAdjustOpen(event, this.adjustOpen());
    this.adjustOpen.set(next);
    if (next === 'adjust') this.scrollAdjustIntoView();
  }

  /** Rechnet die Nährwert-Felder aus den Bezugswerten und der aktuellen Menge neu. */
  private rescale(): void {
    if (this.isBaseStale) this.rebaseScaleBase();
    if (this.isBaseStale) return;
    const base = this.scaleBase;
    if (!base) return;
    const factor = base.unit === 'g' ? (this.baseAmount ?? 0) / 100 : (this.form.servings ?? 0);
    if (factor <= 0) return;
    this.form = { ...this.form, ...fieldsFromFacts(scaleFacts(base.facts, factor)) };
  }

  /** Schreibt Name + Nährwerte ins Formular und wechselt zur Mengen-Ansicht. */
  private applyFacts(name: string, facts: NutritionFacts, opts: ApplyOptions = {}): void {
    const unit: QuantityUnit = facts.basis === 'per100g' ? 'g' : 'portion';
    const baseAmount = unit === 'g' ? (opts.amountG ?? opts.servingG ?? DEFAULT_AMOUNT_G) : null;
    const shownUnit = opts.unit ?? unitForName(name);
    const amountG = baseAmount == null ? null : fromBaseAmount(baseAmount, shownUnit);
    const servings = unit === 'portion' ? (opts.servings ?? 1) : null;
    const factor = unit === 'g' ? (baseAmount ?? 0) / 100 : (servings ?? 0);

    this.scaleBase = { facts, unit };
    this.isBaseStale = false;
    this.addDirty = false;
    this.kcalManual = true;
    clearRawTexts(this.rawTexts, ADD_FORM_TEXT_KEYS);
    this.amountUnit = shownUnit;
    this.unitTouched = false;
    this.pickedRecipeId = opts.recipeId ?? null;
    this.pickedBrand = opts.brand;
    this.pickedServingG = unit === 'g' ? (opts.servingG ?? null) : null;
    this.form = {
      ...this.form,
      ...fieldsFromFacts(scaleFacts(facts, factor)),
      label: name,
      amountG,
      servings,
    };
    this.hint.set(opts.hint ?? null);
    this.sourceNote.set(null);
    this.isAiEstimate.set(opts.isAi ?? false);
    this.isPartialSource = opts.isPartial ?? false;
    this.error.set(null);
    this.adjustOpen.set(undefined);
    this.view.set('form');
    setTimeout(() => this.amountRow?.focus(), AMOUNT_FOCUS_DELAY_MS);
  }

  /** Übernimmt ein Rezept (Nährwerte je Portion) ins Formular; Menge = Portionen. */
  async selectRecipe(recipe: StoredRecipe): Promise<void> {
    this.retryQuick = false;
    const loaded = await this.recipeLoad.load(recipe);
    if (!loaded) return;
    this.applyFacts(recipe.title, loaded.facts, { recipeId: recipe.id, isPartial: countMissingFacts(loaded.recipe.ingredients) > 0 });
  }

  /** „Erneut versuchen“ nach einem Ladefehler: wiederholt die letzte Rezeptwahl. */
  retryRecipe(): void {
    const state = this.recipeLoad.state();
    if (state.kind === 'error') void (this.retryQuick ? this.quickAddRecipe(state.recipe) : this.selectRecipe(state.recipe));
  }

  /** Übernimmt ein gespeichertes eigenes Lebensmittel ins Formular. */
  selectCustomFood(food: CustomFood): void {
    this.applyFacts(food.name, food.facts);
  }

  /** Öffnet einen zuletzt benutzten Eintrag zum Anpassen (statt ihn direkt zu loggen). */
  editRecent(entry: DiaryEntry): void {
    const base = entry.baseFacts?.basis === 'per100g' ? entry.baseFacts : null;
    if (base) {
      this.applyFacts(entry.label, base, { amountG: entry.amountG ?? DEFAULT_AMOUNT_G, unit: entry.unit, brand: entry.brand });
      return;
    }
    // entry.facts gelten für alle Portionen -> auf eine Portion zurückrechnen.
    this.applyFacts(entry.label, perServingFacts(entry.facts, entry.servings), {
      servings: entry.servings,
      brand: entry.brand,
      recipeId: entry.ref?.kind === 'recipe' ? entry.ref.recipeId : undefined,
      isPartial: entry.isPartial,
    });
  }

  // --- Favoriten ---
  readonly favoriteList = this.favoriteStore.favorites;

  isFavorite(entry: DiaryEntry): boolean {
    return this.favoriteStore.isFavorite(entry);
  }

  toggleRecentFavorite(entry: DiaryEntry): void {
    if (ensureWritable(this.favoriteStore, this.toastCtrl)) this.favoriteStore.toggle(entry);
  }

  /** Entfernt einen Favoriten; „Rückgängig“ merkt ihn mit denselben Werten erneut (T20). */
  removeFavorite(id: string): void {
    const fav = this.favoriteList().find((f) => f.id === id);
    if (!fav || !ensureWritable(this.favoriteStore, this.toastCtrl)) return;
    this.favoriteStore.remove(id);
    this.showToast(`„${fav.label}“ aus den Favoriten entfernt.`, () => this.restoreFavorite(fav));
  }

  private restoreFavorite(fav: FavoriteFood): void {
    if (!ensureWritable(this.favoriteStore, this.toastCtrl) || this.favoriteStore.isFavorite(fav)) return;
    const entry: DiaryEntry = {
      ...newEntryFromFavorite(fav, this.date(), 'snack'),
      ref: fav.ref ?? { kind: 'manual' },
      id: fav.id,
      createdAt: fav.createdAt,
    };
    this.favoriteStore.toggle(entry);
  }

  /** Loggt einen Favoriten sofort mit seiner gemerkten Menge. */
  quickAddFavorite(fav: FavoriteFood): void {
    this.addAndConfirm([newEntryFromFavorite(fav, this.date(), this.form.meal)]);
  }

  // --- Schnell-Loggen (ein Tipp) ---
  /** Loggt einen zuletzt benutzten Eintrag sofort mit seiner letzten Menge. */
  quickAddRecent(entry: DiaryEntry): void {
    this.addAndConfirm([entryFromRecent(entry, this.date(), this.form.meal)]);
  }

  /** Loggt eine Portion eines Rezepts sofort. */
  async quickAddRecipe(recipe: StoredRecipe): Promise<void> {
    this.retryQuick = true;
    const loaded = await this.recipeLoad.load(recipe);
    if (!loaded) {
      if (!isOnlineRef(recipe) && !recipe.factsPerServing) this.showToast(NO_RECIPE_FACTS_MESSAGE);
      return;
    }
    const entry = entryFromRecipe({ ...loaded.recipe, factsPerServing: loaded.facts }, this.date(), this.form.meal);
    if (entry) this.addAndConfirm([entry]);
    else this.showToast(NO_RECIPE_FACTS_MESSAGE);
  }

  /** Loggt alle Einträge einer gespeicherten Mahlzeit sofort in die gewählte Mahlzeit. */
  quickAddSavedMeal(meal: SavedMeal): void {
    this.addAndConfirm(entriesFromSavedMeal(meal, this.date(), this.form.meal));
  }

  mealKcal(meal: SavedMeal): number {
    return this.mealsStore.totalKcal(meal);
  }

  /** Eiweiß (g) einer gespeicherten Mahlzeit. */
  mealProtein(meal: SavedMeal): number {
    return savedMealProtein(meal);
  }

  /** Schnell-Eintrag: das Sheet bleibt offen, die Bestätigung kommt als Toast mit Essenszeit, kcal und Eiweiß. */
  private addAndConfirm(inputs: NewDiaryEntry[]): void {
    if (this.isSaving || !ensureWritable(this.diary, this.toastCtrl)) return;
    this.isSaving = true;
    setTimeout(() => (this.isSaving = false), QUICK_ADD_LOCK_MS);
    lightHaptic();
    const added = inputs.flatMap((input) => this.diary.tryAdd(input) ?? []);
    if (added.length < inputs.length) {
      added.forEach((e) => this.diary.remove(e.id));
      void showEntryToast(this.toastCtrl, WRITE_BLOCKED_MESSAGE);
      return;
    }
    this.addedCount.update((n) => n + added.length);
    const totals = sumEntryTotals(added);
    this.showToast(entryAddedMessage(this.form.meal, totals), () => {
      if (!ensureWritable(this.diary, this.toastCtrl)) return;
      added.forEach((e) => this.diary.remove(e.id));
      this.addedCount.update((n) => Math.max(0, n - added.length));
    });
  }

  // --- Ergebnis aus Suche / Barcode / Etikett (nt-food-sources) ---
  onSource(res: FoodSourceResult): void {
    this.applyFacts(res.name, res.facts, { brand: res.brand, isAi: res.isAi, hint: res.hint, servingG: plausibleServingG(res.servingG) });
    if (res.blankFields) this.form = { ...this.form, ...res.blankFields };
    this.sourceNote.set(sourceAttribution(res.source, false));
    if (res.code) void this.addPriceHint(res.code);
  }

  /** Etikett nicht lesbar: ins manuelle Formular wechseln, Meldung bleibt sichtbar. */
  onScanFailed(message: string): void {
    this.openManualEntry();
    this.error.set(message);
  }

  /** Realen Preis (Open Prices) best-effort ergänzen — blockiert nichts. */
  private async addPriceHint(code: string): Promise<void> {
    const token = this.hint.begin();
    const price = await this.prices.priceByBarcode(code);
    if (price && this.hint.setIfCurrent(token, priceHintText(price))) this.sourceNote.set(sourceAttribution('barcode', true));
  }

  // --- Speichern ---
  save(): void {
    if (this.isSaving) return;
    const base = this.scaleBase;
    const typedLabel = this.form.label.trim();
    // Nur Kalorien (ohne Name): als Schnell-Eintrag; mit Quelle (Suche, Rezept) ist der Name immer gesetzt.
    const isQuickEntry = !typedLabel && !base && factsFromFields(this.form) !== null;
    const label = isQuickEntry ? QUICK_ENTRY_LABEL : typedLabel;
    const facts = factsFromFields(this.form);
    const problem = checkAddForm({
      label,
      sourceUnit: base?.unit ?? null,
      baseAmount: this.baseAmount,
      servings: this.form.servings,
      amountEntered: this.form.amountG,
      hasFacts: facts !== null,
    });
    if (problem || !facts) {
      this.error.set(problem?.message ?? '');
      if (problem?.openAdjust) this.adjustOpen.set('adjust');
      return;
    }

    if (!ensureWritable(this.diary, this.toastCtrl)) return;
    this.isSaving = true;
    const isPortion = base?.unit === 'portion';
    const recipeId = this.pickedRecipeId;
    const entry = this.diary.tryAdd({
      dateISO: this.date(),
      meal: this.form.meal,
      label,
      brand: this.pickedBrand,
      ref: recipeId ? { kind: 'recipe', recipeId } : undefined,
      servings: isPortion ? (this.form.servings ?? 1) : undefined,
      amountG: this.baseAmount ?? undefined,
      facts,
      baseFacts: baseFactsForSave(base?.facts ?? null, base?.unit === 'g', this.baseAmount, facts),
      isEstimate: this.isAiEstimate() || undefined,
      isPartial: this.isPartialSource || undefined,
      unit: this.baseAmount ? this.amountUnit : undefined,
    });
    if (!entry) {
      this.isSaving = false;
      void showEntryToast(this.toastCtrl, WRITE_BLOCKED_MESSAGE);
      return;
    }
    const remember = !isQuickEntry && shouldRememberAsCustomFood({ recipeId, baseUnit: base?.unit, isEstimate: this.isAiEstimate() });
    if (remember) this.customFoods.save(label, facts);

    lightHaptic();
    this.closeAdd();
    this.showToast(entryAddedMessage(this.form.meal, facts), () => {
      if (ensureWritable(this.diary, this.toastCtrl)) this.diary.remove(entry.id);
    });
  }

  private showToast(message: string, onUndo?: () => void): void {
    void showEntryToast(this.toastCtrl, message, onUndo);
  }
}
