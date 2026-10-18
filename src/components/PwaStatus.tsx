import React, { useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { CheckCircle2, RefreshCw, X } from 'lucide-react';

const HOUR_MS = 60 * 60 * 1000;

/** Informe de la disponibilité hors ligne et propose les mises à jour (jamais de rechargement imposé en plein relevé). */
export const PwaStatus: React.FC = () => {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (registration) setInterval(() => registration.update().catch(() => undefined), HOUR_MS);
    },
  });

  // Le message « prêt hors ligne » disparaît seul ; la mise à jour reste affichée jusqu'à décision
  useEffect(() => {
    if (!offlineReady) return;
    const t = setTimeout(() => setOfflineReady(false), 6000);
    return () => clearTimeout(t);
  }, [offlineReady, setOfflineReady]);

  if (!offlineReady && !needRefresh) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-16 z-[60] flex justify-center px-3">
      <div
        role="status"
        className="pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-xl border border-emerald-500/40 bg-slate-900/98 px-3.5 py-2.5 text-xs text-slate-100 shadow-2xl backdrop-blur-md animate-fade-in"
      >
        {needRefresh ? (
          <>
            <RefreshCw className="h-4 w-4 shrink-0 text-emerald-400" />
            <span className="flex-1">Une nouvelle version d’Arpentis est disponible.</span>
            <button
              onClick={() => updateServiceWorker(true)}
              className="rounded-lg bg-emerald-600 px-3 py-1.5 font-bold text-white hover:bg-emerald-500"
            >
              Actualiser
            </button>
            <button onClick={() => setNeedRefresh(false)} aria-label="Plus tard" className="text-slate-400 hover:text-white">
              <X className="h-4 w-4" />
            </button>
          </>
        ) : (
          <>
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
            <span className="flex-1">Prêt pour une utilisation hors ligne.</span>
            <button onClick={() => setOfflineReady(false)} aria-label="Fermer" className="text-slate-400 hover:text-white">
              <X className="h-4 w-4" />
            </button>
          </>
        )}
      </div>
    </div>
  );
};
