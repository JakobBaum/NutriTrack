import { AlertController } from '@ionic/angular';

/** Laufende Abfrage: ein zweiter Aufruf (Doppeltipp, X plus Wischen) bekommt dieselbe Antwort statt eines zweiten Dialogs. */
let pending: Promise<boolean> | null = null;

async function askDiscard(alerts: AlertController): Promise<boolean> {
  const alert = await alerts.create({
    header: 'Verwerfen?',
    message: 'Deine Eingaben sind noch nicht gespeichert.',
    buttons: [
      { text: 'Weiter bearbeiten', role: 'cancel' },
      { text: 'Verwerfen', role: 'destructive' },
    ],
  });
  await alert.present();
  const { role } = await alert.onDidDismiss();
  return role === 'destructive';
}

/** Fragt „Verwerfen?“; true = Eingaben verwerfen und schließen. Zeigt nie zwei Dialoge gleichzeitig. */
export function confirmDiscard(alerts: AlertController): Promise<boolean> {
  pending ??= askDiscard(alerts).finally(() => { pending = null; });
  return pending;
}
