import { AlertController } from '@ionic/angular';

/** Fragt „Verwerfen?“; true = Eingaben verwerfen und schließen. */
export async function confirmDiscard(alerts: AlertController): Promise<boolean> {
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
