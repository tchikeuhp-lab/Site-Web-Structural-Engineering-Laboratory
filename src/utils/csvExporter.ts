import { AuditProject, CalculationResult } from '../types/survey';
import { formatAgrarian } from './geometryEngine';
import { formatDms } from './satelliteEngine';
import { getPointGeodetic } from './projectGeo';
import { toUtm } from './utm';
import { safeFileName, shareOrDownload } from './download';

/** Cellule CSV sûre : neutralise l'injection de formule (=, +, -, @) et protège ; " et sauts de ligne. */
export function csvCell(value: string | number | undefined | null): string {
  let s = value === undefined || value === null ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(s) && !/^[-+]?\d+([.,]\d+)?$/.test(s)) s = `'${s}`;
  if (/[;"\r\n]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

const num = (v: number, d: number) => v.toFixed(d).replace('.', ',');

export function generateCsvContent(project: AuditProject, metrics: CalculationResult): string {
  const points = project.points;
  const agrarian = formatAgrarian(metrics.areaM2);
  const origin = project.originGeodetic;

  const rows: string[] = [];

  rows.push(`Projet;${csvCell(project.title)}`);
  rows.push(`Référence Cadastrale;${csvCell(project.referenceCadastrale || 'Non spécifiée')}`);
  rows.push(`Opérateur;${csvCell(project.operatorName || 'Non spécifié')}`);
  rows.push(`Date du relevé;${new Date(project.updatedAt).toLocaleDateString('fr-FR')}`);
  rows.push(`Superficie Totale (m²);${num(metrics.areaM2, 2)}`);
  rows.push(`Superficie Agraire;${csvCell(agrarian.formattedString)}`);
  rows.push(`Périmètre Total (m);${num(metrics.perimeterM, 2)}`);
  rows.push(`Nombre de Bornes;${points.length}`);
  rows.push(`Repère;${origin ? 'Géoréférencé (plan tangent local, WGS84)' : 'Coordonnées locales (non géoréférencé)'}`);
  rows.push('');

  rows.push(
    'Index;Nom Borne;X Local (m);Y Local (m);Latitude WGS84;Longitude WGS84;Coordonnées DMS;Précision GPS (m);Cote suivante (m);Angle Intérieur (°);Gisement suivant (°);Zone UTM;Est UTM (m);Nord UTM (m);Source'
  );

  points.forEach((p, i) => {
    const edge = metrics.edges.find((e) => e.fromId === p.id);
    const geo = getPointGeodetic(p, origin);
    const utm = geo ? toUtm(geo.lat, geo.lon) : null;

    rows.push(
      [
        i + 1,
        csvCell(p.name),
        num(p.x, 3),
        num(p.y, 3),
        geo ? num(geo.lat, 7) : '',
        geo ? num(geo.lon, 7) : '',
        geo ? csvCell(formatDms(geo.lat, geo.lon)) : '',
        p.gpsAccuracy ? num(p.gpsAccuracy, 2) : '',
        edge ? num(edge.length, 2) : '',
        edge && edge.interiorAngleDeg !== undefined ? num(edge.interiorAngleDeg, 1) : '',
        edge ? num(edge.gisementDeg, 2) : '',
        utm ? `${utm.zone}${utm.hemisphere}` : '',
        utm ? num(utm.easting, 2) : '',
        utm ? num(utm.northing, 2) : '',
        p.source ?? '',
      ].join(';')
    );
  });

  // BOM UTF-8 pour l'ouverture correcte des accents sous Excel
  return '﻿' + rows.join('\r\n');
}

export async function downloadOrShareCsv(project: AuditProject, metrics: CalculationResult): Promise<boolean> {
  const blob = new Blob([generateCsvContent(project, metrics)], { type: 'text/csv;charset=utf-8;' });
  return shareOrDownload(blob, `${safeFileName(project.title)}_bornes.csv`, 'text/csv', {
    title: `Carnet de bornes : ${project.title}`,
    text: `Tableau des bornes et cotes Arpentis pour ${project.title}`,
  });
}
