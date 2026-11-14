import { describe, expect, it } from 'vitest';
import { HEALTH_NOTES } from './health-notes';

describe('HEALTH_NOTES', () => {
  it('enthält den Profilhinweis im vorgegebenen Wortlaut', () => {
    expect(HEALTH_NOTES.profile).toBe('Orientierungswerte, kein Ersatz für ärztlichen Rat. Nicht für Schwangere, Stillende, unter 18 oder bei Essstörung.');
  });

  it('warnt beim Fastfood vor Schätzung und fehlender Allergenprüfung', () => {
    expect(HEALTH_NOTES.fastfood).toContain('keine Angaben des Restaurants');
    expect(HEALTH_NOTES.fastfood).toContain('Allergene und Unverträglichkeiten werden nicht geprüft');
  });

  it('nennt den Namensfilter ausdrücklich keine Allergiesicherung', () => {
    expect(HEALTH_NOTES.nameFilter).toBe('Filter nach Zutatennamen, keine Allergiesicherung.');
  });

  it('verwendet keine Gedankenstriche als Satzzeichen', () => {
    expect(Object.values(HEALTH_NOTES).some((t) => /[—–]/.test(t))).toBe(false);
  });
});
