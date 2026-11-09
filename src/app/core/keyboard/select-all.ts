/** Markiert beim Fokussieren den ganzen Inhalt eines ion-input, damit der alte Wert beim Tippen ersetzt wird. */
export function selectAllOnFocus(event: Event): void {
  const el = event.target as { getInputElement?: () => Promise<HTMLInputElement> } | null;
  void el?.getInputElement?.().then(
    (input) => input.select(),
    (err: unknown) => console.error('Eingabefeld konnte nicht markiert werden', err),
  );
}
