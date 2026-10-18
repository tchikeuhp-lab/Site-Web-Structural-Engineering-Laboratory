import { Capacitor } from '@capacitor/core';

/** Vrai quand l'application tourne dans le conteneur Android (Capacitor), faux dans un navigateur. */
export const isNative = (): boolean => {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
};
