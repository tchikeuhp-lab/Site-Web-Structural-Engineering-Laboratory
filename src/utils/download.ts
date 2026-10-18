/**
 * Utilitaires de téléchargement / partage de fichiers (100 % côté navigateur).
 */

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

export function triggerDownload(blob: Blob, fileName: string): void {
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
