import { backupStatusLabel, goalLabel, hasManualTarget } from './settings-view';

describe('settings-view', () => {
  describe('goalLabel', () => {
    it('uebersetzt bekannte Ziele', () => {
      expect(goalLabel('lose')).toBe('Abnehmen');
      expect(goalLabel('maintain')).toBe('Halten');
      expect(goalLabel('gain')).toBe('Zunehmen');
    });

    it('liefert null bei fehlendem oder unbekanntem Ziel', () => {
      expect(goalLabel(undefined)).toBeNull();
      expect(goalLabel('')).toBeNull();
      expect(goalLabel('toString')).toBeNull();
    });
  });

  describe('hasManualTarget', () => {
    it('ist false ohne Profil oder ohne manuelle Werte', () => {
      expect(hasManualTarget(null)).toBe(false);
      expect(hasManualTarget({})).toBe(false);
    });

    it('ist true bei manuellem kcal- oder Eiweiss-Ziel, auch bei 0', () => {
      expect(hasManualTarget({ manualKcal: 2200 })).toBe(true);
      expect(hasManualTarget({ manualProteinGPerKg: 1.8 })).toBe(true);
      expect(hasManualTarget({ manualKcal: 0 })).toBe(true);
    });
  });

  describe('backupStatusLabel', () => {
    it('zeigt das Datum oder den Leerzustand', () => {
      expect(backupStatusLabel('09.11.2026')).toBe('Letztes Backup: 09.11.2026');
      expect(backupStatusLabel(null)).toBe('Noch kein Backup erstellt');
    });
  });
});
