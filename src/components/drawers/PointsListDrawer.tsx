import React, { useEffect, useState } from 'react';
import { Point2D, CalculationResult } from '../../types/survey';
import { X, Trash2, Plus, ArrowUpDown, CornerDownRight, Satellite, Globe, MapPin, Info } from 'lucide-react';
import { formatDms } from '../../utils/satelliteEngine';
import { getPointGeodetic } from '../../utils/projectGeo';
import { parseDecimal } from '../../utils/numbers';
import { NumberField } from '../NumberField';
import { useConfirm } from '../ConfirmDialog';

export type PointEditMode = 'xy' | 'geo' | 'meta';

interface PointsListDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  points: Point2D[];
  metrics: CalculationResult;
  /** Origine WGS84 du relevé ; absente = coordonnées locales uniquement */
  originGeodetic?: { lat: number; lon: number };
  /** Donne le focus au formulaire de saisie à l'ouverture (depuis le bouton [+] → Saisie coordonnées) */
  autoFocusForm?: boolean;
  onUpdatePoint: (point: Point2D, mode: PointEditMode) => void;
  onAddPoint: (point: Point2D) => void;
  /** Ajout par latitude/longitude : retourne un message d'erreur, ou null si la borne est ajoutée */
  onAddGeoPoint: (input: { lat: number; lon: number; name?: string; source: 'manual' }) => string | null;
  onDeletePoint: (id: string) => void;
  onInvertPoints: () => void;
  onClearPoints: () => void;
  onOpenGpsModal: () => void;
}

const inputBase =
  'rounded-lg border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500';

export const PointsListDrawer: React.FC<PointsListDrawerProps> = ({
  isOpen,
  onClose,
  points,
  metrics,
  originGeodetic,
  autoFocusForm = false,
  onUpdatePoint,
  onAddPoint,
  onAddGeoPoint,
  onDeletePoint,
  onInvertPoints,
  onClearPoints,
  onOpenGpsModal,
}) => {
  const confirm = useConfirm();
  const [coordType, setCoordType] = useState<'metric' | 'gps'>('metric');
  const [gpsDisplayMode, setGpsDisplayMode] = useState<'dd' | 'dms'>('dd');

  const [manualName, setManualName] = useState('');
  const [manualX, setManualX] = useState('');
  const [manualY, setManualY] = useState('');
  const [manualLat, setManualLat] = useState('');
  const [manualLon, setManualLon] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  // Relevé en coordonnées locales avec des bornes : l'ajout/affichage GPS n'a pas de sens
  const gpsUnavailable = points.length > 0 && !originGeodetic;

  useEffect(() => {
    if (gpsUnavailable && coordType === 'gps') setCoordType('metric');
  }, [gpsUnavailable, coordType]);

  if (!isOpen) return null;

  const handleManualAdd = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (coordType === 'metric') {
      const x = parseDecimal(manualX);
      const y = parseDecimal(manualY);
      if (x === null || y === null) {
        setFormError('Saisissez des valeurs numériques pour X et Y.');
        return;
      }
      onAddPoint({
        id: `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
        name: manualName.trim() || `P${points.length + 1}`,
        x,
        y,
        source: originGeodetic ? 'manual' : 'local',
      });
      setManualX('');
      setManualY('');
    } else {
      const lat = parseDecimal(manualLat);
      const lon = parseDecimal(manualLon);
      if (lat === null || lon === null) {
        setFormError('Saisissez des valeurs numériques pour la latitude et la longitude.');
        return;
      }
      if (Math.abs(lat) > 90 || Math.abs(lon) > 180) {
        setFormError('Latitude : −90 à 90°. Longitude : −180 à 180°.');
        return;
      }
      const error = onAddGeoPoint({ lat, lon, name: manualName.trim() || undefined, source: 'manual' });
      if (error) {
        setFormError(error);
        return;
      }
      setManualLat('');
      setManualLon('');
    }
    setManualName('');
  };

  const handleClear = async () => {
    const ok = await confirm({
      title: 'Supprimer toutes les bornes ?',
      message: `Les ${points.length} bornes de ce relevé seront supprimées. Vous pourrez annuler juste après.`,
      confirmLabel: 'Tout supprimer',
      danger: true,
    });
    if (ok) onClearPoints();
  };

  return (
    <div className="fixed inset-0 z-40 flex flex-col justify-end bg-black/60 backdrop-blur-xs" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="mx-auto flex max-h-[85dvh] w-full flex-col rounded-t-3xl border-t border-slate-800 bg-slate-900 p-4 shadow-2xl md:max-w-2xl"
      >
        <div className="mx-auto mb-2 h-1.5 w-12 rounded-full bg-slate-700" />
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div>
            <h2 className="text-base font-bold text-white">Carnet de bornes & coordonnées</h2>
            <p className="text-xs text-slate-400">
              {points.length} {points.length > 1 ? 'bornes' : 'borne'} · Périmètre : {metrics.perimeterM.toFixed(2)} m
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            {points.length >= 3 && (
              <button
                onClick={onInvertPoints}
                className="flex h-8 px-2 items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 text-slate-300 text-xs hover:bg-slate-700"
                title="Inverser le sens de rotation"
              >
                <ArrowUpDown className="h-3 w-3" />
                <span className="hidden sm:inline">Sens</span>
              </button>
            )}
            <button
              onClick={onClose}
              aria-label="Fermer"
              className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-800 text-slate-400 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 py-2.5 border-b border-slate-800">
          <div className="flex items-center gap-1 p-0.5 rounded-lg bg-slate-800 border border-slate-700">
            <button
              onClick={() => setCoordType('metric')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold transition ${
                coordType === 'metric' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              <MapPin className="h-3.5 w-3.5" />
              <span>Métrique (X, Y)</span>
            </button>
            <button
              onClick={() => !gpsUnavailable && setCoordType('gps')}
              disabled={gpsUnavailable}
              title={gpsUnavailable ? 'Ce relevé est en coordonnées locales (non géoréférencé)' : undefined}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${
                coordType === 'gps' ? 'bg-cyan-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Globe className="h-3.5 w-3.5" />
              <span>GPS (Lat, Lon)</span>
            </button>
          </div>

          <button
            onClick={() => {
              onClose();
              onOpenGpsModal();
            }}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-cyan-600/20 border border-cyan-500/40 text-cyan-300 text-xs font-bold hover:bg-cyan-600/30 transition shrink-0"
          >
            <Satellite className="h-3.5 w-3.5" />
            <span>Borner par GPS</span>
          </button>
        </div>

        {gpsUnavailable && (
          <div className="mt-2 flex items-start gap-2 rounded-lg border border-slate-700 bg-slate-800/60 p-2 text-[11px] text-slate-300">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan-400" />
            <span>
              Ce relevé est en <strong>coordonnées locales</strong> (non géoréférencé) : les ajouts GPS et les exports
              SIG (GeoJSON, KML) sont indisponibles. Pour géoréférencer, commencez un nouveau relevé par une borne GPS.
            </span>
          </div>
        )}

        {coordType === 'gps' && (
          <div className="flex items-center justify-end gap-1.5 py-1.5 text-[11px] font-mono text-slate-400">
            <span>Affichage :</span>
            <button
              onClick={() => setGpsDisplayMode('dd')}
              className={`px-1.5 py-0.5 rounded ${gpsDisplayMode === 'dd' ? 'bg-cyan-600 text-white font-bold' : 'hover:text-white'}`}
            >
              Degrés décimaux
            </button>
            <span>·</span>
            <button
              onClick={() => setGpsDisplayMode('dms')}
              className={`px-1.5 py-0.5 rounded ${gpsDisplayMode === 'dms' ? 'bg-cyan-600 text-white font-bold' : 'hover:text-white'}`}
            >
              Sexagésimal
            </button>
          </div>
        )}

        <form onSubmit={handleManualAdd} className="py-2.5 border-b border-slate-800/80">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
            {coordType === 'metric'
              ? 'Ajouter une borne par coordonnées métriques locales'
              : 'Ajouter une borne par latitude / longitude (WGS84)'}
          </div>
          <div className="grid grid-cols-7 gap-1.5 items-center">
            <input
              type="text"
              aria-label="Nom de la borne"
              autoFocus={autoFocusForm}
              placeholder="Nom (ex: P1)"
              value={manualName}
              onChange={(e) => setManualName(e.target.value)}
              className={`col-span-2 ${inputBase} font-sans`}
            />
            {coordType === 'metric' ? (
              <>
                <input
                  type="text"
                  inputMode="decimal"
                  aria-label="X en mètres"
                  placeholder="X (m)"
                  value={manualX}
                  onChange={(e) => setManualX(e.target.value)}
                  className={`col-span-2 ${inputBase}`}
                />
                <input
                  type="text"
                  inputMode="decimal"
                  aria-label="Y en mètres"
                  placeholder="Y (m)"
                  value={manualY}
                  onChange={(e) => setManualY(e.target.value)}
                  className={`col-span-2 ${inputBase}`}
                />
              </>
            ) : (
              <>
                <input
                  type="text"
                  inputMode="decimal"
                  aria-label="Latitude en degrés décimaux"
                  placeholder="Lat (°)"
                  value={manualLat}
                  onChange={(e) => setManualLat(e.target.value)}
                  className={`col-span-2 ${inputBase}`}
                />
                <input
                  type="text"
                  inputMode="decimal"
                  aria-label="Longitude en degrés décimaux"
                  placeholder="Lon (°)"
                  value={manualLon}
                  onChange={(e) => setManualLon(e.target.value)}
                  className={`col-span-2 ${inputBase}`}
                />
              </>
            )}
            <button
              type="submit"
              aria-label="Ajouter la borne"
              className="col-span-1 flex h-8 items-center justify-center rounded-lg bg-emerald-600 text-white hover:bg-emerald-500"
              title="Ajouter la borne"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
          {formError && (
            <p role="alert" className="mt-1.5 text-[11px] text-rose-400">
              {formError}
            </p>
          )}
        </form>

        <div className="flex-1 overflow-y-auto py-2 space-y-2">
          {points.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-500">
              Aucune borne définie. Saisissez des coordonnées ci-dessus ou utilisez « Borner par GPS ».
            </div>
          ) : (
            points.map((p, idx) => {
              const edge = metrics.edges.find((e) => e.fromId === p.id);
              const geo = getPointGeodetic(p, originGeodetic);

              return (
                <div key={p.id} className="rounded-xl border border-slate-800 bg-slate-800/40 p-2.5 flex flex-col gap-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-emerald-500/10 border border-emerald-500/30 text-[10px] font-mono font-bold text-emerald-400">
                        {idx + 1}
                      </span>
                      <input
                        type="text"
                        aria-label={`Nom de la borne ${idx + 1}`}
                        value={p.name}
                        onChange={(e) => onUpdatePoint({ ...p, name: e.target.value }, 'meta')}
                        className="w-24 rounded bg-slate-900 border border-slate-700 px-1.5 py-0.5 text-xs font-semibold text-white focus:outline-none focus:border-cyan-500"
                      />
                      {p.source === 'gnss' && p.gpsAccuracy ? (
                        <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950/80 px-1.5 py-0.5 rounded border border-cyan-800/60">
                          ±{p.gpsAccuracy.toFixed(1)}m
                        </span>
                      ) : p.source === 'simulated' ? (
                        <span className="text-[10px] font-mono text-purple-300 bg-purple-950/80 px-1.5 py-0.5 rounded border border-purple-800/60">
                          simulé
                        </span>
                      ) : null}
                    </div>

                    <div className="flex items-center gap-2">
                      {edge && (
                        <div className="flex items-center gap-1 text-[11px] font-mono text-slate-400">
                          <CornerDownRight className="h-3 w-3 text-slate-500" />
                          <span>{edge.length.toFixed(2)}m</span>
                        </div>
                      )}
                      <button
                        onClick={() => onDeletePoint(p.id)}
                        aria-label={`Supprimer la borne ${p.name}`}
                        className="flex h-7 w-7 items-center justify-center rounded-md text-slate-500 hover:bg-rose-500/10 hover:text-rose-400"
                        title="Supprimer cette borne"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {coordType === 'metric' || !geo ? (
                    <div className="flex items-center gap-2 font-mono text-xs text-slate-300 pl-8">
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-slate-500">X:</span>
                        <NumberField
                          ariaLabel={`X de ${p.name}`}
                          value={p.x}
                          decimals={3}
                          onCommit={(x) => onUpdatePoint({ ...p, x }, 'xy')}
                          className="w-20 rounded bg-slate-900 border border-slate-700 px-1 py-0.5 text-xs text-right text-slate-200"
                        />
                        <span className="text-[10px] text-slate-500">m</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-slate-500">Y:</span>
                        <NumberField
                          ariaLabel={`Y de ${p.name}`}
                          value={p.y}
                          decimals={3}
                          onCommit={(y) => onUpdatePoint({ ...p, y }, 'xy')}
                          className="w-20 rounded bg-slate-900 border border-slate-700 px-1 py-0.5 text-xs text-right text-slate-200"
                        />
                        <span className="text-[10px] text-slate-500">m</span>
                      </div>
                    </div>
                  ) : (
                    <div className="pl-8 text-xs font-mono text-slate-300">
                      {gpsDisplayMode === 'dd' ? (
                        <div className="grid grid-cols-2 gap-2">
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-slate-500">Lat:</span>
                            <NumberField
                              ariaLabel={`Latitude de ${p.name}`}
                              value={geo.lat}
                              decimals={7}
                              min={-90}
                              max={90}
                              onCommit={(lat) => onUpdatePoint({ ...p, lat, lon: geo.lon }, 'geo')}
                              className="w-full rounded bg-slate-900 border border-slate-700 px-1 py-0.5 text-xs text-slate-200"
                            />
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-slate-500">Lon:</span>
                            <NumberField
                              ariaLabel={`Longitude de ${p.name}`}
                              value={geo.lon}
                              decimals={7}
                              min={-180}
                              max={180}
                              onCommit={(lon) => onUpdatePoint({ ...p, lat: geo.lat, lon }, 'geo')}
                              className="w-full rounded bg-slate-900 border border-slate-700 px-1 py-0.5 text-xs text-slate-200"
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="text-[11px] text-cyan-300 truncate">{formatDms(geo.lat, geo.lon)}</div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {points.length > 0 && (
          <div className="pt-2 border-t border-slate-800 flex justify-between items-center">
            <span className="text-xs text-slate-500">
              Surface : <strong className="text-emerald-400">{metrics.areaM2.toFixed(2)} m²</strong>
            </span>
            <button
              onClick={handleClear}
              className="text-xs text-rose-400 hover:text-rose-300 transition-colors flex items-center gap-1 py-1 px-2 rounded hover:bg-rose-500/10"
            >
              <Trash2 className="h-3 w-3" />
              Tout supprimer
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
