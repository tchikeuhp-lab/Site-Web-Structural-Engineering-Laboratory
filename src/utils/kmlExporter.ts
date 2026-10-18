import { AuditProject, CalculationResult } from '../types/survey';
import { formatAgrarian } from './geometryEngine';
import { geodeticPointsOrThrow } from './geojsonExporter';
import { safeFileName, shareOrDownload } from './download';

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Génère un fichier KML 2.2 (Google Earth). Aucune ressource externe n'est référencée.
 */
export function generateKmlContent(project: AuditProject, metrics: CalculationResult): string {
  const geodeticPoints = geodeticPointsOrThrow(project);
  const agrarian = formatAgrarian(metrics.areaM2);

  const lines: string[] = [];

  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push('<kml xmlns="http://www.opengis.net/kml/2.2">');
  lines.push('  <Document>');
  lines.push(`    <name>${escapeXml(project.title)}</name>`);
  lines.push(
    `    <description>Relevé Arpentis. Superficie : ${metrics.areaM2.toFixed(2)} m² (${escapeXml(agrarian.formattedString)}). Périmètre : ${metrics.perimeterM.toFixed(2)} m.</description>`
  );

  lines.push('    <Style id="polygonStyle">');
  lines.push('      <LineStyle><color>ff81b910</color><width>3</width></LineStyle>'); // aabbggrr
  lines.push('      <PolyStyle><color>7f699905</color></PolyStyle>');
  lines.push('    </Style>');

  if (geodeticPoints.length >= 3) {
    const coordsStr = [...geodeticPoints, geodeticPoints[0]]
      .map((p) => `${p.lon},${p.lat},${p.altitude ?? 0}`)
      .join(' ');

    lines.push('    <Placemark>');
    lines.push(`      <name>Emprise - ${escapeXml(project.title)}</name>`);
    lines.push('      <styleUrl>#polygonStyle</styleUrl>');
    lines.push('      <Polygon>');
    lines.push('        <tessellate>1</tessellate>');
    lines.push('        <altitudeMode>clampToGround</altitudeMode>');
    lines.push('        <outerBoundaryIs><LinearRing>');
    lines.push(`          <coordinates>${coordsStr}</coordinates>`);
    lines.push('        </LinearRing></outerBoundaryIs>');
    lines.push('      </Polygon>');
    lines.push('    </Placemark>');
  }

  geodeticPoints.forEach((p, i) => {
    const accuracy = p.gpsAccuracy ? `&#10;Précision GPS : ±${p.gpsAccuracy.toFixed(1)} m` : '';
    lines.push('    <Placemark>');
    lines.push(`      <name>${escapeXml(p.name)}</name>`);
    lines.push(
      `      <description>Borne n°${i + 1}&#10;Lat : ${p.lat.toFixed(7)}°&#10;Lon : ${p.lon.toFixed(7)}°${accuracy}</description>`
    );
    lines.push('      <Point>');
    lines.push(`        <coordinates>${p.lon},${p.lat},${p.altitude ?? 0}</coordinates>`);
    lines.push('      </Point>');
    lines.push('    </Placemark>');
  });

  lines.push('  </Document>');
  lines.push('</kml>');

  return lines.join('\n');
}

export async function downloadOrShareKml(
  project: AuditProject,
  metrics: CalculationResult
): Promise<boolean> {
  const content = generateKmlContent(project, metrics);
  const blob = new Blob([content], { type: 'application/vnd.google-earth.kml+xml;charset=utf-8' });
  return shareOrDownload(blob, `${safeFileName(project.title)}.kml`, 'application/vnd.google-earth.kml+xml', {
    title: `KML Google Earth : ${project.title}`,
    text: `Fichier KML de la parcelle ${project.title}`,
  });
}
