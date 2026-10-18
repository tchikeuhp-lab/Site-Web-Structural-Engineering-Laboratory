import { registerPlugin } from '@capacitor/core';
import { isNative } from './platform';

interface NativePrintPlugin {
  print(options: { name: string }): Promise<void>;
}

const NativePrint = registerPlugin<NativePrintPlugin>('NativePrint');

/**
 * Imprime / exporte en PDF la fiche affichée. Sur Android, la WebView n'implémente pas window.print() :
 * on passe par le plugin natif (gestionnaire d'impression Android, qui propose « Enregistrer au format PDF »).
 */
export async function printPage(documentName: string): Promise<void> {
  if (isNative()) {
    try {
      await NativePrint.print({ name: documentName });
      return;
    } catch (err) {
      console.error('Arpentis — impression native indisponible', err);
    }
  }
  window.print();
}
