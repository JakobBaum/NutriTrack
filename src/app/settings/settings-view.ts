const GOAL_LABELS: Readonly<Record<string, string>> = { lose: 'Abnehmen', maintain: 'Halten', gain: 'Zunehmen' };

/** Ziel des gespeicherten Profils als Lesetext (z. B. „Abnehmen“), sonst null. */
export function goalLabel(goal: string | null | undefined): string | null {
  return goal && Object.hasOwn(GOAL_LABELS, goal) ? GOAL_LABELS[goal] : null;
}

/** Das Tagesziel ist ganz oder teilweise manuell festgelegt (Karte zeigt „manuell“). */
export function hasManualTarget(
  profile: { manualKcal?: number; manualProteinGPerKg?: number } | null | undefined,
): boolean {
  return profile?.manualKcal !== undefined || profile?.manualProteinGPerKg !== undefined;
}

/** Zeile „Letztes Backup: …“ aus dem formatierten Datum (null = nie gesichert). */
export function backupStatusLabel(formattedDate: string | null): string {
  return formattedDate ? `Letztes Backup: ${formattedDate}` : 'Noch kein Backup erstellt';
}
