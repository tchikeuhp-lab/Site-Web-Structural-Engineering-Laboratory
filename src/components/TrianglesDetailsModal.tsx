import React from 'react';
import { CalculationResult } from '../types/survey';
import { X, Layers, CheckCircle } from 'lucide-react';

interface TrianglesDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  metrics: CalculationResult;
}

export const TrianglesDetailsModal: React.FC<TrianglesDetailsModalProps> = ({
  isOpen,
  onClose,
  metrics,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-2xl text-slate-100 flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-emerald-400" />
            <div>
              <h2 className="text-base font-bold text-white">Décomposition & Contrôle de Héron</h2>
              <p className="text-xs text-slate-400">Triangulation interne du polygone</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-800 text-slate-400 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-3 space-y-3">
          <div className="rounded-xl border border-slate-800 bg-slate-950 p-3 text-xs leading-relaxed text-slate-300">
            <p className="mb-2">
              Pour garantir une exactitude absolue, le polygone est découpé par l'algorithme d'<strong>Ear-Clipping</strong> en triangles élémentaires dont la surface est calculée indépendamment par la formule de Héron :
            </p>
            <div className="font-mono text-emerald-400 bg-slate-900 p-2 rounded-lg text-center text-[11px]">
              S = √( p · (p - a) · (p - b) · (p - c) )
            </div>
          </div>

          <div className="space-y-2">
            {metrics.triangles.map((tri, i) => (
              <div
                key={tri.id}
                className="rounded-xl border border-slate-800 bg-slate-800/40 p-3 text-xs font-mono"
              >
                <div className="flex justify-between items-center text-slate-200 font-bold mb-1">
                  <span>Triangle {i + 1} ({tri.p1.name} — {tri.p2.name} — {tri.p3.name})</span>
                  <span className="text-emerald-400">{tri.area.toFixed(2)} m²</span>
                </div>
                <div className="text-[11px] text-slate-400 grid grid-cols-3 gap-1">
                  <span>a = {tri.a.toFixed(2)}m</span>
                  <span>b = {tri.b.toFixed(2)}m</span>
                  <span>c = {tri.c.toFixed(2)}m</span>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-between items-center p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs font-bold text-emerald-300">
            <span>Somme des triangles :</span>
            <span className="font-mono text-sm">
              {metrics.triangles.reduce((acc, t) => acc + t.area, 0).toFixed(2)} m²
            </span>
          </div>
        </div>

        <div className="pt-3 border-t border-slate-800">
          <button
            onClick={onClose}
            className="w-full rounded-xl bg-slate-800 py-2.5 text-xs font-bold text-slate-200 hover:bg-slate-700"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};
