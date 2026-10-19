import React, { useState } from 'react';
import { AuditProject, CalculationResult } from '../../types/survey';
import { downloadOrShareDxf, DxfUtmUnavailableError } from '../../utils/dxfExporter';
import { SHEET_FORMATS, STANDARD_SCALES, type SheetFormatName } from '../../utils/dxfSheet';
import { downloadOrShareCsv } from '../../utils/csvExporter';
import { downloadOrShareGeoJson } from '../../utils/geojsonExporter';
import { downloadOrShareKml } from '../../utils/kmlExporter';
import { formatAgrarian } from '../../utils/geometryEngine';
import { formatDms } from '../../utils/satelliteEngine';
import { toUtm, formatUtm } from '../../utils/utm';
import { NotGeoreferencedError } from '../../utils/geojsonExporter';
import { FileCode, FileText, FileSpreadsheet, Globe, Map, X, CheckCircle, ShieldCheck, AlertCircle } from 'lucide-react';

interface ExportDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  project: AuditProject;
  metrics: CalculationResult;
  onUpdateProjectMeta: (updates: Partial<AuditProject>) => void;
  onOpenPdfReport: () => void;
}

export const ExportDrawer: React.FC<ExportDrawerProps> = ({
  isOpen,
  onClose,
  project,
  metrics,
  onUpdateProjectMeta,
  onOpenPdfReport,
}) => {
  const [dxfUtm, setDxfUtm] = useState(false);
  const [dxfSheetOn, setDxfSheetOn] = useState(true);
  const [dxfFormat, setDxfFormat] = useState<SheetFormatName | 'auto'>('auto');
  const [dxfScale, setDxfScale] = useState<number | 'auto'>('auto');
  const [exportFeedback, setExportFeedback] = useState<{ ok: boolean; text: string } | null>(null);

  if (!isOpen) return null;

  const agrarian = formatAgrarian(metrics.areaM2);
  const origin = project.originGeodetic;
  const georeferenced = !!origin;
  const utm = origin ? toUtm(origin.lat, origin.lon) : null;

  const run = async (label: string, job: () => Promise<boolean>) => {
    try {
      const delivered = await job();
      if (delivered) {
        setExportFeedback({ ok: true, text: `${label} exporté avec succès.` });
        setTimeout(() => setExportFeedback(null), 3000);
      }
    } catch (err) {
      setExportFeedback({
        ok: false,
        text: err instanceof NotGeoreferencedError || err instanceof DxfUtmUnavailableError ? err.message : `Erreur lors de l’export ${label}.`,
      });
    }
  };

  const handleExportDxf = () =>
    run('DXF', () => downloadOrShareDxf(project, metrics, {
      coordinates: dxfUtm && georeferenced ? 'utm' : 'local',
      titleBlock: dxfSheetOn,
      sheet: { format: dxfFormat, scale: dxfScale },
    }));
  const handleExportCsv = () => run('CSV', () => downloadOrShareCsv(project, metrics));
  const handleExportGeoJson = () => run('GeoJSON', () => downloadOrShareGeoJson(project, metrics));
  const handleExportKml = () => run('KML', () => downloadOrShareKml(project, metrics));

  return (
    <div className="fixed inset-0 z-40 flex flex-col justify-end bg-black/60 backdrop-blur-xs" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="mx-auto w-full md:max-w-2xl rounded-t-3xl border-t border-slate-800 bg-slate-900 p-4 shadow-2xl max-h-[85dvh] flex flex-col">
        {/* Poignée & En-tête */}
        <div className="mx-auto mb-2 h-1.5 w-12 rounded-full bg-slate-700" />
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div>
            <h2 className="text-base font-bold text-white">Exports & fiche de relevé</h2>
            <p className="text-xs text-slate-400">Exports 100 % hors ligne (CAO, SIG, PDF, tableur)</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Fermer"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-800 text-slate-400 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {exportFeedback && (
          <div
            role={exportFeedback.ok ? 'status' : 'alert'}
            className={`my-2 flex items-start gap-2 rounded-xl border p-2.5 text-xs font-semibold ${
              exportFeedback.ok
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : 'bg-rose-500/10 border-rose-500/40 text-rose-300'
            }`}
          >
            {exportFeedback.ok ? <CheckCircle className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
            <span>{exportFeedback.text}</span>
          </div>
        )}

        <div className="flex-1 overflow-y-auto py-2 space-y-4">
          {/* Métadonnées de l'audit */}
          <div className="rounded-2xl border border-slate-800 bg-slate-800/30 p-3 space-y-2.5">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-300">
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
              <span>Cartouche & Mentions Techniques</span>
            </div>

            <div>
              <label className="text-[11px] text-slate-400 block mb-0.5">Désignation de la parcelle</label>
              <input
                type="text"
                value={project.title}
                onChange={(e) => onUpdateProjectMeta({ title: e.target.value })}
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs font-semibold text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] text-slate-400 block mb-0.5">Réf. Cadastrale</label>
                <input
                  type="text"
                  placeholder="Ex: Section B n°142"
                  value={project.referenceCadastrale}
                  onChange={(e) => onUpdateProjectMeta({ referenceCadastrale: e.target.value })}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-400 block mb-0.5">Opérateur / Arpenteur</label>
                <input
                  type="text"
                  placeholder="Ex: J. Dupont"
                  value={project.operatorName}
                  onChange={(e) => onUpdateProjectMeta({ operatorName: e.target.value })}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="border-t border-slate-700/50 pt-2">
              <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">Cartouche du plan (export DXF)</div>
              <div className="grid grid-cols-2 gap-2">
                <div className="col-span-2">
                  <label className="text-[11px] text-slate-400 block mb-0.5">Maître d’ouvrage / Propriétaire</label>
                  <input type="text" placeholder="Ex: Société Étoile SARL" value={project.client ?? ''} onChange={(e) => onUpdateProjectMeta({ client: e.target.value })} className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500" />
                </div>
                <div className="col-span-2">
                  <label className="text-[11px] text-slate-400 block mb-0.5">Localisation</label>
                  <input type="text" placeholder="Ex: Yaoundé, Mfou, lieu-dit Nkolbisson" value={project.location ?? ''} onChange={(e) => onUpdateProjectMeta({ location: e.target.value })} className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500" />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 block mb-0.5">N° de plan</label>
                  <input type="text" placeholder="Ex: PL-2026-042" value={project.planNumber ?? ''} onChange={(e) => onUpdateProjectMeta({ planNumber: e.target.value })} className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500" />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 block mb-0.5">Indice de révision</label>
                  <input type="text" placeholder="Ex: A" maxLength={4} value={project.revision ?? ''} onChange={(e) => onUpdateProjectMeta({ revision: e.target.value })} className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500" />
                </div>
                <div className="col-span-2">
                  <label className="text-[11px] text-slate-400 block mb-0.5">Vérifié par</label>
                  <input type="text" placeholder="Ex: M. Kamga" value={project.checkedBy ?? ''} onChange={(e) => onUpdateProjectMeta({ checkedBy: e.target.value })} className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500" />
                </div>
              </div>
            </div>

            <div className="pt-1 text-[10px] font-mono text-slate-400 border-t border-slate-700/50 space-y-0.5">
              {origin && utm ? (
                <>
                  <div className="flex justify-between gap-2">
                    <span>Origine WGS84 :</span>
                    <span className="text-cyan-300 text-right">{formatDms(origin.lat, origin.lon)}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span>UTM (EPSG:{utm.epsg}) :</span>
                    <span className="text-cyan-300 text-right">{formatUtm(utm)}</span>
                  </div>
                </>
              ) : (
                <div className="flex justify-between gap-2">
                  <span>Repère :</span>
                  <span className="text-amber-300">Coordonnées locales (non géoréférencé)</span>
                </div>
              )}
            </div>
          </div>

          {/* Synthèse des mesures à exporter */}
          <div className="rounded-2xl border border-slate-800 bg-slate-950 p-3 font-mono text-xs space-y-1">
            <div className="flex justify-between text-slate-400">
              <span>Superficie :</span>
              <strong className="text-emerald-400 text-sm">{metrics.areaM2.toFixed(2)} m²</strong>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Agraire :</span>
              <span className="text-slate-200">{agrarian.formattedString}</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Périmètre :</span>
              <span className="text-slate-200">{metrics.perimeterM.toFixed(2)} m</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Bornes :</span>
              <span className="text-slate-200">{project.points.length} sommets</span>
            </div>
          </div>

          {/* Actions d'Exportations Multi-Formats */}
          <div className="space-y-2">
            {/* Export 1 : GeoJSON (SIG / QGIS) */}
            <button
              onClick={handleExportGeoJson}
              disabled={!georeferenced}
              className="flex w-full items-center justify-between rounded-xl border border-cyan-500/30 bg-cyan-500/10 p-3 text-left transition hover:bg-cyan-500/20 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-cyan-600 text-white">
                  <Globe className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Format GeoJSON (SIG / QGIS)</h3>
                  <p className="text-[11px] text-cyan-200/80">
                    Standard RFC 7946 (WGS84) : polygone et bornes — exige un relevé géoréférencé
                  </p>
                </div>
              </div>
              <span className="text-xs font-mono font-bold text-cyan-400">.geojson</span>
            </button>

            {/* Export 2 : KML Google Earth */}
            <button
              onClick={handleExportKml}
              disabled={!georeferenced}
              className="flex w-full items-center justify-between rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-left transition hover:bg-amber-500/20 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-600 text-white">
                  <Map className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Google Earth (KML)</h3>
                  <p className="text-[11px] text-amber-200/80">
                    Visualisation dans Google Earth et applications de cartes — relevé géoréférencé
                  </p>
                </div>
              </div>
              <span className="text-xs font-mono font-bold text-amber-400">.kml</span>
            </button>

            {/* Export 3 : DXF AutoCAD */}
            <button
              onClick={handleExportDxf}
              className="flex w-full items-center justify-between rounded-xl border border-blue-500/30 bg-blue-500/10 p-3 text-left transition hover:bg-blue-500/20 active:scale-[0.99]"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white">
                  <FileCode className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Fichier DXF (AutoCAD / CAO)</h3>
                  <p className="text-[11px] text-blue-200/80">
                    Format R12, coordonnées locales en mètres, calques LIMITES / BORNES / COTATIONS
                  </p>
                </div>
              </div>
              <span className="text-xs font-mono font-bold text-blue-400">.dxf</span>
            </button>
            <label
              className={`flex items-center gap-2 px-1 text-[11px] ${georeferenced ? 'text-slate-300' : 'text-slate-600'}`}
            >
              <input
                type="checkbox"
                checked={dxfUtm && georeferenced}
                disabled={!georeferenced}
                onChange={(e) => setDxfUtm(e.target.checked)}
                className="h-3.5 w-3.5 accent-blue-500"
              />
              <span>
                DXF en coordonnées UTM{utm ? ` (zone ${utm.zone}${utm.hemisphere}, EPSG:${utm.epsg})` : ''} — pour superposer
                à un fond SIG ou cadastral
              </span>
            </label>

            <label className="flex items-start gap-2 px-1 text-[11px] text-slate-300">
              <input
                type="checkbox"
                checked={dxfSheetOn}
                onChange={(e) => setDxfSheetOn(e.target.checked)}
                className="mt-0.5 h-3.5 w-3.5 accent-blue-500"
              />
              <span>Cadre de feuille et cartouche normalisés (ISO 5457 / ISO 7200), tableau des coordonnées, nord et échelle graphique</span>
            </label>
            {dxfSheetOn && (
              <div className="grid grid-cols-2 gap-2 px-1">
                <label className="text-[11px] text-slate-400">
                  Format
                  <select
                    value={dxfFormat}
                    onChange={(e) => setDxfFormat(e.target.value as SheetFormatName | 'auto')}
                    className="mt-0.5 w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-white"
                  >
                    <option value="auto">Automatique</option>
                    {SHEET_FORMATS.map((f) => (
                      <option key={f.name} value={f.name}>{f.name} paysage</option>
                    ))}
                  </select>
                </label>
                <label className="text-[11px] text-slate-400">
                  Échelle
                  <select
                    value={String(dxfScale)}
                    onChange={(e) => setDxfScale(e.target.value === 'auto' ? 'auto' : Number(e.target.value))}
                    className="mt-0.5 w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-white"
                  >
                    <option value="auto">Automatique</option>
                    {STANDARD_SCALES.filter((d) => d >= 10 && d <= 10000).map((d) => (
                      <option key={d} value={d}>1:{d}</option>
                    ))}
                  </select>
                </label>
              </div>
            )}

            {/* Export 4 : Rapport d'Audit PDF Imprimable */}
            <button
              onClick={() => {
                onClose();
                onOpenPdfReport();
              }}
              className="flex w-full items-center justify-between rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-left transition hover:bg-emerald-500/20 active:scale-[0.99]"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Fiche de relevé (PDF)</h3>
                  <p className="text-[11px] text-emerald-200/80">
                    Fiche A4 prête à imprimer avec plan, carnet de bornes et gisements
                  </p>
                </div>
              </div>
              <span className="text-xs font-mono font-bold text-emerald-400">.pdf</span>
            </button>

            {/* Export 5 : CSV Carnet de Cotes */}
            <button
              onClick={handleExportCsv}
              className="flex w-full items-center justify-between rounded-xl border border-slate-700 bg-slate-800/60 p-3 text-left transition hover:bg-slate-800 active:scale-[0.99]"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-700 text-white">
                  <FileSpreadsheet className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Carnet de Cotes CSV</h3>
                  <p className="text-[11px] text-slate-400">
                    Bornes, cotes, gisements, coordonnées WGS84 et UTM
                  </p>
                </div>
              </div>
              <span className="text-xs font-mono font-bold text-slate-300">.csv</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
