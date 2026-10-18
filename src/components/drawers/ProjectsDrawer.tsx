import React, { useRef } from 'react';
import { AuditProject } from '../../types/survey';
import { calculateShoelaceArea, formatAreaValue } from '../../utils/geometryEngine';
import {
  AlertTriangle,
  Copy,
  Download,
  FilePlus2,
  FlaskConical,
  FolderOpen,
  MapPinned,
  Trash2,
  Upload,
  X,
} from 'lucide-react';

interface ProjectsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  projects: AuditProject[];
  activeId: string;
  storageAvailable: boolean;
  onOpenProject: (id: string) => void;
  onNewProject: () => void;
  onLoadExample: () => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onImportFile: (file: File) => void;
  onExportCurrent: () => void;
  onExportAll: () => void;
}

export const ProjectsDrawer: React.FC<ProjectsDrawerProps> = ({
  isOpen,
  onClose,
  projects,
  activeId,
  storageAvailable,
  onOpenProject,
  onNewProject,
  onLoadExample,
  onDuplicate,
  onDelete,
  onImportFile,
  onExportCurrent,
  onExportAll,
}) => {
  const fileRef = useRef<HTMLInputElement>(null);
  if (!isOpen) return null;

  const sorted = [...projects].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  return (
    <div className="fixed inset-0 z-40 flex flex-col justify-end bg-black/60 backdrop-blur-xs" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="mx-auto flex max-h-[85dvh] w-full flex-col rounded-t-3xl border-t border-slate-800 bg-slate-900 p-4 shadow-2xl md:max-w-2xl"
      >
        <div className="mx-auto mb-2 h-1.5 w-12 rounded-full bg-slate-700" />
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <h2 className="text-base font-bold text-white">Mes relevés</h2>
            <p className="text-xs text-slate-400">
              {projects.length} relevé{projects.length > 1 ? 's' : ''} · enregistrés sur cet appareil
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Fermer"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-800 text-slate-400 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {!storageAvailable && (
          <div className="mt-2 flex items-start gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 p-2.5 text-[11px] text-amber-200">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Le stockage local est indisponible (navigation privée ?). Vos relevés seront perdus à la fermeture :
              exportez-les en JSON.
            </span>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2 py-3">
          <button
            onClick={onNewProject}
            className="flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2.5 text-xs font-bold text-white hover:bg-emerald-500"
          >
            <FilePlus2 className="h-4 w-4" /> Nouveau relevé
          </button>
          <button
            onClick={() => fileRef.current?.click()}
            className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3 py-2.5 text-xs font-semibold text-slate-200 hover:bg-slate-700"
          >
            <Upload className="h-4 w-4" /> Importer (JSON)
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onImportFile(f);
              e.target.value = '';
            }}
          />
        </div>

        <div className="flex-1 space-y-2 overflow-y-auto pb-2">
          {sorted.map((p) => {
            const isActive = p.id === activeId;
            const area = calculateShoelaceArea(p.points).areaM2;
            return (
              <div
                key={p.id}
                className={`rounded-xl border p-3 ${
                  isActive ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-slate-800 bg-slate-800/40'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h3 className="truncate text-sm font-bold text-white">{p.title}</h3>
                      {isActive && (
                        <span className="shrink-0 rounded bg-emerald-500/20 px-1.5 py-0.5 text-[9px] font-bold uppercase text-emerald-300">
                          ouvert
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 font-mono text-[11px] text-slate-400">
                      {p.points.length} borne{p.points.length > 1 ? 's' : ''} ·{' '}
                      {area > 0 ? formatAreaValue(area, p.unit) : 'pas de surface'}
                    </p>
                    <p className="mt-0.5 flex items-center gap-1 text-[10px] text-slate-500">
                      <MapPinned className="h-3 w-3" />
                      {p.originGeodetic ? 'Géoréférencé' : 'Coordonnées locales'} · modifié le{' '}
                      {new Date(p.updatedAt).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {!isActive && (
                      <button
                        onClick={() => onOpenProject(p.id)}
                        className="flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-[11px] font-bold text-white hover:bg-emerald-500"
                      >
                        <FolderOpen className="h-3.5 w-3.5" /> Ouvrir
                      </button>
                    )}
                    <button
                      onClick={() => onDuplicate(p.id)}
                      aria-label={`Dupliquer ${p.title}`}
                      title="Dupliquer"
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-700 hover:text-white"
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => onDelete(p.id)}
                      aria-label={`Supprimer ${p.title}`}
                      title="Supprimer"
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-rose-500/10 hover:text-rose-400"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="space-y-2 border-t border-slate-800 pt-3">
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={onExportCurrent}
              className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-[11px] font-semibold text-slate-200 hover:bg-slate-700"
            >
              <Download className="h-3.5 w-3.5" /> Sauvegarder ce relevé
            </button>
            <button
              onClick={onExportAll}
              className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-[11px] font-semibold text-slate-200 hover:bg-slate-700"
            >
              <Download className="h-3.5 w-3.5" /> Tout sauvegarder
            </button>
          </div>
          <button
            onClick={onLoadExample}
            className="flex w-full items-center justify-center gap-1.5 rounded-xl px-3 py-1.5 text-[11px] text-slate-400 hover:text-slate-200"
          >
            <FlaskConical className="h-3.5 w-3.5" /> Charger une parcelle d’exemple
          </button>
        </div>
      </div>
    </div>
  );
};
