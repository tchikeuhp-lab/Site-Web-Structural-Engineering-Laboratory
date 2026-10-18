import { isNative } from './platform';

type BackHandler = () => boolean;

/**
 * Initialisation spécifique à Android : barre d'état, écran de démarrage, bouton « retour ».
 * `onBack` doit retourner true s'il a consommé l'appui (fermeture d'un tiroir, d'une fenêtre…).
 * Sinon l'application est mise en arrière-plan (jamais fermée brutalement : le relevé reste en mémoire).
 * Retourne une fonction de nettoyage.
 */
export async function initNative(onBack: BackHandler): Promise<() => void> {
  if (!isNative()) return () => undefined;
  const [{ App }, { StatusBar, Style }, { SplashScreen }] = await Promise.all([
    import('@capacitor/app'),
    import('@capacitor/status-bar'),
    import('@capacitor/splash-screen'),
  ]);

  try {
    await StatusBar.setStyle({ style: Style.Dark });
    await StatusBar.setBackgroundColor({ color: '#0f172a' });
  } catch {
    /* non bloquant */
  }
  void SplashScreen.hide().catch(() => undefined);

  const handle = await App.addListener('backButton', () => {
    if (!onBack()) void App.minimizeApp();
  });
  return () => {
    void handle.remove();
  };
}
