import React, { useState } from 'react';
import { Compass, Download, FolderOpen, Wifi, WifiOff, Edit3, Check, Satellite } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

interface MobileTopBarProps {
  title: string;
  onUpdateTitle: (newTitle: string) => void;
  onOpenProjects: () => void;
  onOpenGpsModal: () => void;
  gpsAccuracy?: number | null;
}

export const MobileTopBar: React.FC<MobileTopBarProps> = ({
  title,
  onUpdateTitle,
  onOpenProjects,
  onOpenGpsModal,
  gpsAccuracy,
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const isOnline = useOnlineStatus();
  const [showIOSPrompt, setShowIOSPrompt] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [tempTitle, setTempTitle] = useState(title);

  const handleSaveTitle = () => {
    if (tempTitle.trim()) {
      onUpdateTitle(tempTitle.trim());
    } else {
      setTempTitle(title);
    }
    setIsEditingTitle(false);
  };

  return (
    <>
      <header className="sticky top-0 z-30 flex h-14 shrink-0 w-full items-center justify-between border-b border-slate-800 bg-slate-900/95 px-3.5 backdrop-blur-md">
        {/* Zone 1: Logo & Titre */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
            <Compass className="h-4 w-4" />
          </div>

          {isEditingTitle ? (
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                value={tempTitle}
                onChange={(e) => setTempTitle(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSaveTitle()}
                autoFocus
                className="h-8 max-w-[140px] sm:max-w-[200px] rounded border border-emerald-500 bg-slate-800 px-2 text-xs font-semibold text-white focus:outline-none"
              />
              <button
                onClick={handleSaveTitle}
                aria-label="Valider le titre"
                className="flex h-8 w-8 items-center justify-center rounded bg-emerald-600 text-white"
                title="Valider"
              >
                <Check className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => {
                setTempTitle(title);
                setIsEditingTitle(true);
              }}
              className="group flex items-center gap-1.5 text-left min-w-0 text-slate-100 hover:text-white"
            >
              <span className="truncate text-sm font-bold tracking-tight">{title}</span>
              <Edit3 className="h-3 w-3 text-slate-500 opacity-60 group-hover:opacity-100" />
            </button>
          )}
        </div>

        {/* Zone 2: Statut Hors-ligne & Actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Bouton Acquisition Satellite GNSS */}
          <button
            onClick={onOpenGpsModal}
            className={`flex items-center gap-1 px-2 py-1 text-[11px] font-mono rounded-md border transition-colors ${
              gpsAccuracy
                ? 'border-cyan-500/40 bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20'
                : 'border-slate-800 bg-slate-800/60 text-slate-400 hover:text-cyan-400'
            }`}
            title="Acquisition GPS / Multi-Satellites"
          >
            <Satellite className="h-3.5 w-3.5 text-cyan-400 animate-pulse" />
            <span>{gpsAccuracy ? `±${gpsAccuracy.toFixed(1)}m` : 'GNSS'}</span>
          </button>

          {/* Statut réseau */}
          <div
            className={`flex items-center gap-1 px-2 py-1 text-[11px] font-mono rounded-md border ${
              isOnline
                ? 'border-slate-800 bg-slate-800/40 text-slate-400'
                : 'border-amber-500/30 bg-amber-500/10 text-amber-400'
            }`}
            title={isOnline ? 'Connexion active (stockage local garanti)' : '100% Hors-ligne'}
          >
            {isOnline ? (
              <Wifi className="h-3 w-3 text-slate-400" />
            ) : (
              <WifiOff className="h-3 w-3 text-amber-400" />
            )}
            <span className="hidden sm:inline">{isOnline ? 'Local' : 'Hors-ligne'}</span>
          </div>

          {/* Bouton Installation PWA */}
          {!isInstalled && isInstallable && (
            <button
              onClick={install}
              className="flex items-center gap-1.5 rounded-md bg-emerald-600 px-2.5 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-emerald-500 transition-colors"
            >
              <Download className="h-3 w-3" />
              <span className="hidden sm:inline">Installer</span>
            </button>
          )}

          {!isInstalled && isIOS && (
            <button
              onClick={() => setShowIOSPrompt(true)}
              className="flex items-center gap-1 rounded-md border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs text-slate-300 hover:bg-slate-700"
            >
              <Download className="h-3 w-3" />
              <span className="text-[10px]">PWA iOS</span>
            </button>
          )}

          {/* Mes relevés (multi-projets, import / sauvegarde) */}
          <button
            onClick={onOpenProjects}
            aria-label="Mes relevés"
            className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-800 bg-slate-800/60 text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
            title="Mes relevés"
          >
            <FolderOpen className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Modal d'installation iOS Safari */}
      {showIOSPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-2xl text-slate-100">
            <h3 className="text-base font-bold text-white mb-2">Installer Arpentis sur iPhone / iPad</h3>
            <p className="text-xs text-slate-300 leading-relaxed mb-4">
              Pour utiliser Arpentis en mode plein écran et 100% hors-ligne dans vos parcelles :
            </p>
            <ol className="text-xs text-slate-400 space-y-2 mb-5 list-decimal pl-4">
              <li>Touchez le bouton <strong>Partager</strong> en bas de Safari (icône carré avec flèche montante).</li>
              <li>Faites défiler vers le bas et touchez <strong>Sur l'écran d'accueil</strong>.</li>
              <li>Validez en haut à droite avec <strong>Ajouter</strong>.</li>
            </ol>
            <button
              onClick={() => setShowIOSPrompt(false)}
              className="w-full rounded-xl bg-slate-800 py-2.5 text-xs font-semibold text-slate-200 hover:bg-slate-700"
            >
              Compris
            </button>
          </div>
        </div>
      )}
    </>
  );
};
