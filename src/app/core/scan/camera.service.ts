import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';

/**
 * Dünner Wrapper um das Capacitor-Camera-Plugin für Etiketten-Fotos.
 *
 * Auf nativen Plattformen (iOS/Android) liefert {@link takePhotoBase64} ein
 * Foto als Base64. Im Web ohne `@ionic/pwa-elements` ist die native Kamera
 * nicht verfügbar — die Diary-Seite fällt dann auf den `<input type=file>`
 * zurück (siehe {@link isNativeCameraAvailable}).
 */
@Injectable({ providedIn: 'root' })
export class CameraService {
  /** True, wenn das native Kamera-Plugin genutzt werden kann (Gerät). */
  isNativeCameraAvailable(): boolean {
    return Capacitor.isNativePlatform();
  }

  /**
   * Nimmt ein Foto auf und gibt den reinen Base64-String zurück (ohne
   * Data-URL-Präfix). Wirft, wenn der Nutzer abbricht oder keine Kamera da ist.
   */
  async takePhotoBase64(): Promise<string> {
    const photo = await Camera.getPhoto({
      resultType: CameraResultType.Base64,
      source: CameraSource.Camera,
      quality: 80,
      correctOrientation: true,
    });
    const base64 = photo.base64String;
    if (!base64) {
      throw new Error('Kein Foto erhalten.');
    }
    return base64;
  }
}
