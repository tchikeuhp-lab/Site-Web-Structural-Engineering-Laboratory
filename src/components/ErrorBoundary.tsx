import React from 'react';
import { loadWorkspace, serializeBackup } from '../storage/projectStore';
import { triggerDownload } from '../utils/download';

interface State {
  error: Error | null;
  backupDone: boolean;
}

/** Filet de sécurité : une erreur d'affichage ne doit jamais faire perdre les relevés (ils restent dans IndexedDB). */
export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { error: null, backupDone: false };

  static getDerivedStateFromError(error: Error): State {
    return { error, backupDone: false };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Arpentis — erreur non gérée', error, info.componentStack);
  }

  private backup = async () => {
    try {
      const ws = await loadWorkspace();
      triggerDownload(
        new Blob([serializeBackup(ws.projects)], { type: 'application/json' }),
        `arpentis-sauvegarde-${new Date().toISOString().slice(0, 10)}.json`
      );
      this.setState({ backupDone: true });
    } catch {
      alert('Sauvegarde impossible : le stockage local est inaccessible.');
    }
  };

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="flex min-h-dvh items-center justify-center bg-slate-950 p-6 text-slate-100">
        <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
          <h1 className="text-base font-bold text-white">Une erreur est survenue</h1>
          <p className="mt-2 text-xs leading-relaxed text-slate-400">
            Vos relevés sont conservés sur cet appareil. Rechargez l’application ; si le problème persiste,
            téléchargez d’abord une sauvegarde.
          </p>
          <pre className="mt-3 max-h-24 overflow-auto rounded-lg bg-slate-950 p-2 text-[10px] text-rose-300">
            {this.state.error.message}
          </pre>
          <div className="mt-4 flex gap-2">
            <button
              onClick={this.backup}
              className="flex-1 rounded-xl border border-slate-700 bg-slate-800 py-2.5 text-xs font-semibold text-slate-200 hover:bg-slate-700"
            >
              {this.state.backupDone ? 'Sauvegarde téléchargée ✓' : 'Sauvegarder mes relevés'}
            </button>
            <button
              onClick={() => window.location.reload()}
              className="flex-1 rounded-xl bg-emerald-600 py-2.5 text-xs font-bold text-white hover:bg-emerald-500"
            >
              Recharger
            </button>
          </div>
        </div>
      </div>
    );
  }
}
