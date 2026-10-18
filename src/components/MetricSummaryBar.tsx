import React from 'react';
import { AreaUnit, CalculationResult } from '../types/survey';
import { formatAgrarian, formatAreaValue } from '../utils/geometryEngine';
import { AlertTriangle, CheckCircle2, ChevronRight, Layers } from 'lucide-react';

interface MetricSummaryBarProps {
  metrics: CalculationResult;
  pointsCount: number;
  currentUnit: AreaUnit;
  onChangeUnit: (unit: AreaUnit) => void;
  onOpenDetails: () => void;
}

export const MetricSummaryBar: React.FC<MetricSummaryBarProps> = ({
  metrics,
  pointsCount,
  currentUnit,
  onChangeUnit,
  onOpenDetails,
}) => {
  const agrarian = formatAgrarian(metrics.areaM2);

  const units: { id: AreaUnit; label: string }[] = [
    { id: 'm2', label: 'm²' },
    { id: 'ha_a_ca', label: 'ha · a · ca' },
    { id: 'ha', label: 'ha' },
    { id: 'a', label: 'ares' },
    { id: 'km2', label: 'km²' },
  ];

  return (
    <div className="z-20 w-full border-t border-slate-800 bg-slate-900/95 px-3.5 py-2.5 backdrop-blur-md shadow-lg">
      <div className="mx-auto flex flex-col gap-1.5 max-w-xl">
        {/* Ligne 1 : Surface Principale & Sélecteur d'Unités Rapide */}
        <div className="flex items-baseline justify-between gap-2">
          <div className="min-w-0">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Superficie Calculée
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-xl sm:text-2xl font-bold font-mono tracking-tight tabular-nums text-emerald-400">
                {formatAreaValue(metrics.areaM2, currentUnit)}
              </span>

              {/* Si unité non agraire, afficher le rappel agraire en discret */}
              {currentUnit === 'm2' && metrics.areaM2 >= 100 && (
                <span className="text-xs font-mono text-slate-400 hidden sm:inline">
                  ({agrarian.formattedString})
                </span>
              )}
            </div>
          </div>

          {/* Commutateur d'unités tactile */}
          <div className="flex items-center gap-1 rounded-lg bg-slate-800 p-0.5 border border-slate-700/60 shrink-0 overflow-x-auto">
            {units.map((u) => (
              <button
                key={u.id}
                onClick={() => onChangeUnit(u.id)}
                className={`px-2 py-1 text-[11px] font-semibold rounded-md transition-colors whitespace-nowrap ${
                  currentUnit === u.id
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {u.label}
              </button>
            ))}
          </div>
        </div>

        {/* Ligne 2 : Périmètre, Nombre de Bornes et Statut de Contrôle */}
        <div className="flex items-center justify-between text-xs text-slate-400 pt-1 border-t border-slate-800/60">
          <div className="flex items-center gap-3 font-mono">
            <span>
              Périmètre : <strong className="text-slate-200">{metrics.perimeterM.toFixed(2)} m</strong>
            </span>
            <span aria-hidden="true" className="text-slate-600">·</span>
            <span>
              <strong className="text-slate-200">{pointsCount}</strong> {pointsCount > 1 ? 'bornes' : 'borne'}
            </span>
          </div>

          {/* Statut géométrique */}
          <button
            onClick={onOpenDetails}
            className="flex items-center gap-1.5 text-slate-300 hover:text-white transition-colors"
          >
            {metrics.isSelfIntersecting ? (
              <span className="flex items-center gap-1 text-rose-400 font-medium text-[11px]">
                <AlertTriangle className="h-3.5 w-3.5" />
                Arêtes croisées
              </span>
            ) : pointsCount >= 3 ? (
              <span className="flex items-center gap-1 text-emerald-400 text-[11px]">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {metrics.triangles.length} triangles
              </span>
            ) : (
              <span className="text-[11px] text-slate-400">En cours de tracé</span>
            )}
            <ChevronRight className="h-3 w-3 text-slate-500" />
          </button>
        </div>
      </div>
    </div>
  );
};
