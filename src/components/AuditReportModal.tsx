import React from 'react';
import { AuditProject, CalculationResult } from '../types/survey';
import { formatAgrarian } from '../utils/geometryEngine';
import { Printer, X, Download, ShieldCheck, Compass } from 'lucide-react';
import { downloadOrShareDxf } from '../utils/dxfExporter';
import { downloadOrShareCsv } from '../utils/csvExporter';
import { getPointGeodetic } from '../utils/projectGeo';
import { toUtm } from '../utils/utm';
import { printPage } from '../platform/nativePrint';
import { SelLogo } from './SelLogo';

interface AuditReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: AuditProject;
  metrics: CalculationResult;
}

export const AuditReportModal: React.FC<AuditReportModalProps> = ({
  isOpen,
  onClose,
  project,
  metrics,
}) => {
  if (!isOpen) return null;

  const agrarian = formatAgrarian(metrics.areaM2);
  const points = project.points;
  const georef = !!project.originGeodetic;
  const trianglesSum = metrics.triangles.reduce((acc, t) => acc + t.area, 0);
  const gapPercent = metrics.areaM2 > 0 ? (Math.abs(trianglesSum - metrics.areaM2) / metrics.areaM2) * 100 : 0;

  // Calcul du bounding box pour le schéma SVG dans le PDF
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }

  const spanX = Math.max(10, maxX - minX);
  const spanY = Math.max(10, maxY - minY);
  const padding = 20;
  const svgWidth = 400;
  const svgHeight = 260;

  const scale = Math.min((svgWidth - padding * 2) / spanX, (svgHeight - padding * 2) / spanY);
  const offsetX = (svgWidth - spanX * scale) / 2;
  const offsetY = (svgHeight - spanY * scale) / 2;

  const toSvgX = (x: number) => offsetX + (x - minX) * scale;
  const toSvgY = (y: number) => svgHeight - (offsetY + (y - minY) * scale); // Invert Y

  const polygonPath = points.reduce(
    (acc, p, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${toSvgX(p.x)} ${toSvgY(p.y)}`,
    ''
  ) + (points.length >= 3 ? ' Z' : '');

  const handlePrint = () => {
    void printPage(`Fiche de relevé — ${project.title || 'Arpentis'}`);
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-center bg-black/80 p-2 sm:p-4 backdrop-blur-sm overflow-y-auto">
      <div className="print-area relative w-full max-w-3xl rounded-2xl border border-slate-700 bg-white text-slate-900 shadow-2xl overflow-hidden my-auto">
        {/* Barre d'action supérieure (non imprimée) */}
        <div className="print:hidden flex items-center justify-between border-b border-slate-200 bg-slate-100 px-4 py-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-emerald-600" />
            <h2 className="text-sm font-bold text-slate-800">Fiche de relevé de superficie</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 transition"
            >
              <Printer className="h-4 w-4" />
              <span>Imprimer / PDF</span>
            </button>
            <button
              onClick={onClose}
              aria-label="Fermer"
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-200 text-slate-600 hover:bg-slate-300"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Corps du Document d'Audit (Imprimable A4) */}
        <div className="p-6 sm:p-8 space-y-6 print:p-0 print:space-y-4">
          {/* Cartouche d'en-tête technique */}
          <div className="border-2 border-slate-900 p-4 rounded-lg">
            <SelLogo isPrint className="mb-3 text-slate-900" />
            <div className="flex justify-between items-start border-b border-slate-300 pb-3 mb-3">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500">
                  Fiche de relevé & métré de parcelle
                </span>
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                  {project.title}
                </h1>
              </div>
              <div className="text-right font-mono text-xs text-slate-600">
                <div>Relevé du : {new Date(project.updatedAt).toLocaleDateString('fr-FR')}</div>
                <div className="font-bold text-slate-800">ARPENTIS v{__APP_VERSION__}</div>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <span className="text-slate-500 block text-[10px] uppercase font-mono">Référence Cadastrale</span>
                <span className="font-semibold text-slate-900">{project.referenceCadastrale || 'Non renseignée'}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px] uppercase font-mono">Opérateur / Métreur</span>
                <span className="font-semibold text-slate-900">{project.operatorName || 'Non renseigné'}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px] uppercase font-mono">Système de Mesure</span>
                <span className="font-semibold text-slate-900">
                  {project.originGeodetic ? 'Plan tangent local (WGS84)' : 'Coordonnées locales'} · Gauss, contrôle Héron
                </span>
              </div>
            </div>
          </div>

          {/* Synthèse des résultats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3">
              <span className="text-[10px] font-mono uppercase text-emerald-800 block">Superficie Totale</span>
              <span className="text-lg sm:text-xl font-bold font-mono text-emerald-950">
                {metrics.areaM2.toFixed(2)} m²
              </span>
            </div>
            <div className="rounded-lg bg-slate-50 border border-slate-200 p-3">
              <span className="text-[10px] font-mono uppercase text-slate-600 block">Décomposition Agraire</span>
              <span className="text-sm sm:text-base font-bold font-mono text-slate-900">
                {agrarian.formattedString}
              </span>
            </div>
            <div className="rounded-lg bg-slate-50 border border-slate-200 p-3">
              <span className="text-[10px] font-mono uppercase text-slate-600 block">Périmètre Déroulé</span>
              <span className="text-lg sm:text-xl font-bold font-mono text-slate-900">
                {metrics.perimeterM.toFixed(2)} m
              </span>
            </div>
            <div className="rounded-lg bg-slate-50 border border-slate-200 p-3">
              <span className="text-[10px] font-mono uppercase text-slate-600 block">Nombre de Bornes</span>
              <span className="text-lg sm:text-xl font-bold font-mono text-slate-900">
                {points.length}
              </span>
            </div>
          </div>

          {/* Schéma Vectoriel de la Parcelle */}
          <div className="border border-slate-300 rounded-lg p-3 bg-slate-50/50">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-bold text-slate-800">Plan de masse & Polygonation des bornes</span>
              <div className="flex items-center gap-1 text-[11px] font-mono text-slate-500">
                <Compass className="h-3 w-3 text-rose-500" />
                <span>Nord à 0° (Haut)</span>
              </div>
            </div>

            <div className="flex justify-center bg-white rounded border border-slate-200 overflow-hidden">
              <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="h-auto w-full max-w-md">
                {/* Lignes du polygone */}
                {points.length >= 3 && (
                  <path
                    d={polygonPath}
                    fill="rgba(16, 185, 129, 0.15)"
                    stroke="#059669"
                    strokeWidth="2"
                    strokeLinejoin="round"
                  />
                )}

                {/* Triangulation interne */}
                {metrics.triangles.map((tri) => (
                  <polygon
                    key={tri.id}
                    points={`${toSvgX(tri.p1.x)},${toSvgY(tri.p1.y)} ${toSvgX(tri.p2.x)},${toSvgY(tri.p2.y)} ${toSvgX(tri.p3.x)},${toSvgY(tri.p3.y)}`}
                    fill="none"
                    stroke="#94a3b8"
                    strokeWidth="0.8"
                    strokeDasharray="3 3"
                  />
                ))}

                {/* Sommets */}
                {points.map((p, idx) => {
                  const sx = toSvgX(p.x);
                  const sy = toSvgY(p.y);
                  return (
                    <g key={p.id}>
                      <circle cx={sx} cy={sy} r="4.5" fill="#059669" />
                      <circle cx={sx} cy={sy} r="2" fill="#ffffff" />
                      <text
                        x={sx + 6}
                        y={sy - 4}
                        fontSize="9"
                        fontWeight="bold"
                        fontFamily="monospace"
                        fill="#0f172a"
                      >
                        {p.name}
                      </text>
                    </g>
                  );
                })}

                {/* Centroïde */}
                {points.length >= 3 && metrics.areaM2 > 0 && (
                  <g transform={`translate(${toSvgX(metrics.centroid.x)}, ${toSvgY(metrics.centroid.y)})`}>
                    <circle cx="0" cy="0" r="3" fill="#d97706" />
                    <text x="5" y="3" fontSize="8" fontWeight="bold" fill="#b45309" fontFamily="monospace">
                      S = {metrics.areaM2.toFixed(1)} m²
                    </text>
                  </g>
                )}
              </svg>
            </div>
          </div>

          {/* Tableau des Bornes & Cotes (Carnet d'Arpentage) */}
          <div>
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
              Carnet de Bornes & Cotes Euclidiennes
            </h3>
            <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b-2 border-slate-800 bg-slate-100 text-[10px] font-mono uppercase text-slate-700">
                  <th className="py-1.5 px-2">Borne</th>
                  <th className="py-1.5 px-2">X / Y (m)</th>
                  {georef && <th className="py-1.5 px-2">Lat. / Lon. (WGS84)</th>}
                  {georef && <th className="py-1.5 px-2">UTM E / N (m)</th>}
                  <th className="py-1.5 px-2">Cote suiv.</th>
                  <th className="py-1.5 px-2">Gisement</th>
                  <th className="py-1.5 px-2">Angle int.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-mono text-[11px]">
                {points.map((p) => {
                  const edge = metrics.edges.find((e) => e.fromId === p.id);
                  const geo = getPointGeodetic(p, project.originGeodetic);
                  const utm = geo ? toUtm(geo.lat, geo.lon) : null;

                  return (
                    <tr key={p.id}>
                      <td className="py-1 px-2 font-bold text-slate-900">{p.name}</td>
                      <td className="py-1 px-2 text-slate-600">{p.x.toFixed(2)} / {p.y.toFixed(2)}</td>
                      {georef && (
                        <td className="py-1 px-2 text-slate-700">
                          {geo ? `${geo.lat.toFixed(6)}° / ${geo.lon.toFixed(6)}°` : '-'}
                        </td>
                      )}
                      {georef && (
                        <td className="py-1 px-2 text-slate-700">
                          {utm ? `${utm.easting.toFixed(2)} / ${utm.northing.toFixed(2)}` : '-'}
                        </td>
                      )}
                      <td className="py-1 px-2 font-semibold text-emerald-800">
                        {edge ? `${edge.length.toFixed(2)} m` : '-'}
                      </td>
                      <td className="py-1 px-2 text-slate-600">{edge ? `${edge.gisementDeg.toFixed(2)}°` : '-'}</td>
                      <td className="py-1 px-2 text-slate-600">
                        {edge && edge.interiorAngleDeg !== undefined ? `${edge.interiorAngleDeg.toFixed(1)}°` : '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          </div>

          {/* Contrôle croisé par triangulation de Héron */}
          {metrics.triangulationComplete && (
            <div className="text-[11px] text-slate-500 border-t border-slate-200 pt-3">
              <span className="font-bold text-slate-700">Contrôle croisé : </span>
              polygone découpé en {metrics.triangles.length} triangles (formule de Héron). Somme des triangles :{' '}
              {trianglesSum.toFixed(2)} m² — écart avec la formule de Gauss : {gapPercent.toFixed(4)} %.
            </div>
          )}

          {/* Signature & Visa */}
          <div className="pt-6 border-t-2 border-slate-900 flex justify-between items-end text-xs">
            <div>
              <span className="block text-slate-500 text-[10px] uppercase font-mono">Visa de l'opérateur</span>
              <span className="font-semibold text-slate-900">{project.operatorName || 'Arpenteur responsable'}</span>
            </div>
            <div className="text-right text-[10px] text-slate-400 font-mono">
              Relevé indicatif établi par Arpentis (mesures GNSS ou coordonnées saisies). Il ne se substitue pas à un bornage ou à un levé réalisé par un géomètre agréé.
            </div>
          </div>
        </div>

        {/* Pied modal (non imprimé) */}
        <div className="print:hidden border-t border-slate-200 bg-slate-50 px-4 py-3 flex justify-between items-center">
          <div className="flex gap-2">
            <button
              onClick={() => downloadOrShareDxf(project, metrics)}
              className="flex items-center gap-1 text-xs text-blue-700 hover:text-blue-900 font-semibold"
            >
              <Download className="h-3.5 w-3.5" />
              Télécharger DXF
            </button>
            <span className="text-slate-300">·</span>
            <button
              onClick={() => downloadOrShareCsv(project, metrics)}
              className="flex items-center gap-1 text-xs text-slate-700 hover:text-slate-900 font-semibold"
            >
              <Download className="h-3.5 w-3.5" />
              Télécharger CSV
            </button>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};
