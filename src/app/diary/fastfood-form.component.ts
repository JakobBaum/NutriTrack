import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, inject } from '@angular/core';
import { Router } from '@angular/router';
import {
  FASTFOOD_CHAINS, FastFoodForm, KCAL_RANGE, MONEY_RANGE, OTHER_RESTAURANT, PREFERENCE_OPTIONS,
  defaultKcalBudget, formatMoney, preferenceValue, resolveRestaurant, restaurantChoice, snapToRange,
} from './fastfood-options';

let nextId = 0;

/** Eingabeformular des Fastfood-Helfers: Restaurant-Picker, Budget-Slider, Priorität. */
@Component({
  selector: 'app-fastfood-form',
  templateUrl: './fastfood-form.component.html',
  styleUrls: ['./fastfood-form.component.scss'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FastfoodFormComponent implements OnChanges {
  private readonly router = inject(Router);

  @Input({ required: true }) form!: FastFoodForm;
  /** Echte KI aktiv; sonst Hinweis "KI verbinden". */
  @Input() live = false;
  /** Rest-kcal des Tages (null = kein Tagesziel bekannt). */
  @Input() remainingKcal: number | null = null;
  @Output() readonly formChange = new EventEmitter<FastFoodForm>();
  /** Wird vor der Navigation zu den KI-Einstellungen ausgelöst (Sheet schließen). */
  @Output() readonly connectAi = new EventEmitter<void>();

  readonly chains = FASTFOOD_CHAINS;
  readonly other = OTHER_RESTAURANT;
  readonly preferences = PREFERENCE_OPTIONS;
  readonly kcalRange = KCAL_RANGE;
  readonly moneyRange = MONEY_RANGE;
  readonly ids = { kcal: `ff-kcal-${nextId}`, money: `ff-money-${nextId++}` };

  choice = FASTFOOD_CHAINS[0];
  customRestaurant = '';
  noMoneyLimit = true;
  /** Letzter Geld-Wert, damit "Kein Limit" an/aus ihn nicht verliert. */
  private lastMoney: number = MONEY_RANGE.default;

  ngOnChanges(changes: SimpleChanges): void {
    if (!changes['form']) return;
    this.choice = restaurantChoice(this.form.restaurant);
    if (this.choice === OTHER_RESTAURANT) this.customRestaurant = this.form.restaurant;
    this.noMoneyLimit = this.form.moneyBudget === null;
    if (this.form.moneyBudget !== null) this.lastMoney = this.form.moneyBudget;
  }

  get kcal(): number {
    return snapToRange(this.form.kcalBudget ?? defaultKcalBudget(this.remainingKcal ?? KCAL_RANGE.max), KCAL_RANGE);
  }

  get money(): number {
    return snapToRange(this.form.moneyBudget ?? this.lastMoney, MONEY_RANGE);
  }

  get moneyText(): string {
    return this.noMoneyLimit ? 'kein Limit' : `${formatMoney(this.money)} €`;
  }

  get preference(): string {
    return preferenceValue(this.form.preference);
  }

  /** True, wenn ein Tagesziel existiert und nichts mehr übrig ist. */
  get budgetUsedUp(): boolean {
    return this.remainingKcal !== null && this.remainingKcal <= 0;
  }

  onChoice(value: unknown): void {
    this.choice = String(value ?? FASTFOOD_CHAINS[0]);
    this.emit({ restaurant: resolveRestaurant(this.choice, this.customRestaurant) });
  }

  onCustom(value: unknown): void {
    this.customRestaurant = String(value ?? '');
    this.emit({ restaurant: resolveRestaurant(this.choice, this.customRestaurant) });
  }

  onKcal(value: unknown): void {
    this.emit({ kcalBudget: snapToRange(Number(value), KCAL_RANGE) });
  }

  onMoney(value: unknown): void {
    this.lastMoney = snapToRange(Number(value), MONEY_RANGE);
    this.emit({ moneyBudget: this.lastMoney });
  }

  onNoLimit(checked: boolean): void {
    this.noMoneyLimit = checked;
    this.emit({ moneyBudget: checked ? null : this.lastMoney });
  }

  onPreference(value: unknown): void {
    this.emit({ preference: preferenceValue(String(value ?? '')) });
  }

  readonly formatPin = (value: number): string => `${value}`;

  openAiSettings(): void {
    this.connectAi.emit();
    void this.router.navigate(['/settings']);
  }

  private emit(patch: Partial<FastFoodForm>): void {
    this.formChange.emit({ ...this.form, ...patch });
  }
}
