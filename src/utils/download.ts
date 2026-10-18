/**
 * Utilitaires de téléchargement / partage de fichiers (100 % local).
 * Sur Android (Capacitor), le fichier est écrit dans le cache de l'application puis proposé via la
 * feuille de partage système (Enregistrer dans Drive, Fichiers, WhatsApp, e-mail…) : le téléchargement
 * par lien `<a download>` n'est pas fiable dans une WebView.
 */
import { isNative } from '../platform/platform';

/** Nom de fichier sûr : on garde les accents, on retire uniquement les caractères interdits. */
export function safeFileName(title: string, fallback = 'releve'): string {
  const cleaned = (title || '')
    .normalize('NFC')
    // eslint-disable-next-line no-control-regex
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '')
    .replace(/\s+/g, '_')
    .replace(/^\.+/, '')
    .slice(0, 80)
    .trim();
  return cleaned || fallback;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error('Lecture du fichier impossible'));
    reader.onload = () => {
      const result = String(reader.result ?? '');
      resolve(result.slice(result.indexOf(',') + 1));
    };
    reader.readAsDataURL(blob);
  });
}

/** Android : écrit le fichier puis ouvre la feuille de partage. Retourne false si l'utilisateur annule. */
async function shareNativeFile(blob: Blob, fileName: string, meta?: { title?: string; text?: string }): Promise<boolean> {
  const [{ Filesystem, Directory }, { Share }] = await Promise.all([import('@capacitor/filesystem'), import('@capacitor/share')]);
  const data = await blobToBase64(blob);
  const written = await Filesystem.writeFile({ path: fileName, data, directory: Directory.Cache, recursive: true });
  try {
    await Share.share({ title: meta?.title ?? fileName, text: meta?.text, url: written.uri, dialogTitle: 'Enregistrer ou partager' });
    return true;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/cancel/i.test(msg)) return false;
    throw err;
  }
}

export function triggerDownload(blob: Blob, fileName: string): void {
  if (isNative()) {
    shareNativeFile(blob, fileName).catch((err) => {
      console.error('Arpentis — partage impossible', err);
      alert('Export impossible : ' + (err instanceof Error ? err.message : 'erreur inconnue'));
    });
    return;
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Laisse le temps au navigateur de démarrer le téléchargement avant de libérer l'URL
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/**
 * Partage natif (mobile) si disponible, sinon téléchargement.
 * Retourne false si l'utilisateur a annulé le partage (aucun téléchargement de repli dans ce cas).
 */
export async function shareOrDownload(
  blob: Blob,
  fileName: string,
  mime: string,
  meta?: { title?: string; text?: string }
): Promise<boolean> {
  if (isNative()) return shareNativeFile(blob, fileName, meta);
  if (typeof navigator !== 'undefined' && navigator.share && navigator.canShare) {
    try {
      const file = new File([blob], fileName, { type: mime });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({ title: meta?.title, text: meta?.text, files: [file] });
        return true;
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return false;
      // Autre erreur : repli sur le téléchargement classique
    }
  }
  triggerDownload(blob, fileName);
  return true;
}
