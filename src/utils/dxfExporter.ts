import { AuditProject, CalculationResult, Point2D } from '../types/survey';
import { calculateBearing, calculateCentroid, formatAgrarian } from './geometryEngine';
import { safeFileName, shareOrDownload } from './download';
import { getPointGeodetic } from './projectGeo';
import { toUtm, utmZoneFromLon } from './utm';

export interface DxfOptions {
  /**
   * 'local' : repère métrique local du relevé (par défaut).
   * 'utm'   : coordonnées WGS 84 / UTM (X = Est, Y = Nord, en mètres), pour superposer le plan à un fond SIG ou cadastral.
   */
  coordinates?: 'local' | 'utm';
}

export class DxfUtmUnavailableError extends Error {
  constructor() {
    super('Export DXF en UTM impossible : ce relevé est en coordonnées locales (non géoréférencé).');
    this.name = 'DxfUtmUnavailableError';
  }
}

/**
 * Génère un fichier DXF conforme AutoCAD R12 ASCII à partir d'un projet de parcelles.
 * En mode UTM, toutes les entités (polygone, bornes, cotes, textes) sont exprimées dans un seul fuseau :
 * celui de la première borne (pas de saut de fuseau à l'intérieur d'une même parcelle).
 */
export function generateDxfContent(
  project: AuditProject,
  metrics: CalculationResult,
  options: DxfOptions = {}
): string {
  const utmMode = options.coordinates === 'utm';
  let epsg = 0;
  let zoneLabel = '';

  // Coordonnées de dessin de chaque borne (locales ou UTM)
  let points: Point2D[] = project.points;
  if (utmMode) {
    const geos = project.points.map((p) => getPointGeodetic(p, project.originGeodetic));
    if (geos.some((g) => g === null)) throw new DxfUtmUnavailableError();
    const zone = geos.length > 0 ? utmZoneFromLon(geos[0]!.lon) : 32;
    points = project.points.map((p, i) => {
      const u = toUtm(geos[i]!.lat, geos[i]!.lon, zone);
      epsg = u.epsg;
      zoneLabel = `${u.zone}${u.hemisphere}`;
      return { ...p, x: u.easting, y: u.northing };
    });
  }
  const n = points.length;
  const byId = new Map(points.map((p) => [p.id, p]));

  // Cotes et centroïde dans le repère de dessin
  const edges = metrics.edges.map((e) => {
    const a = byId.get(e.fromId);
    const b = byId.get(e.toId);
    if (!utmMode || !a || !b) return e;
    return {
      ...e,
      midpoint: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
      angleDeg: calculateBearing(a, b),
    };
  });
  const centroid = utmMode ? calculateCentroid(points) : metrics.centroid;

  const lines: string[] = [];

  // DXF R12 est un format ASCII : on translittère les accents et symboles (m² -> m2)
  const ascii = (v: string) =>
    v
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\x20-\x7E]/g, '?');

  const add = (groupCode: number | string, val: number | string) => {
    lines.push(groupCode.toString());
    // Groupes 1 (texte), 2 et 8 (noms) : contenu textuel
    lines.push(groupCode === 1 ? ascii(val.toString()) : val.toString());
  };

  if (utmMode) {
    add(999, `Arpentis - coordonnees WGS 84 / UTM zone ${zoneLabel} (EPSG:${epsg}), unites : metres, X = Est, Y = Nord`);
  } else {
    add(999, 'Arpentis - repere metrique local du releve, unites : metres');
  }

  // 1. SECTION HEADER
  add(0, 'SECTION');
  add(2, 'HEADER');
  add(9, '$ACADVER');
  add(1, 'AC1009'); // AutoCAD R12 standard
  add(0, 'ENDSEC');

  // 2. SECTION TABLES (Layers)
  add(0, 'SECTION');
  add(2, 'TABLES');
  add(0, 'TABLE');
  add(2, 'LAYER');
  add(70, 4);

  // Layer 1: LIMITES_PARCELLE (Vert - color 3)
  add(0, 'LAYER');
  add(2, 'LIMITES_PARCELLE');
  add(70, 0);
  add(62, 3); // Green
  add(6, 'CONTINUOUS');

  // Layer 2: BORNES_SOMMETS (Cyan - color 4)
  add(0, 'LAYER');
  add(2, 'BORNES_SOMMETS');
  add(70, 0);
  add(62, 4); // Cyan
  add(6, 'CONTINUOUS');

  // Layer 3: COTATIONS_METRIQUES (Jaune - color 2)
  add(0, 'LAYER');
  add(2, 'COTATIONS_METRIQUES');
  add(70, 0);
  add(62, 2); // Yellow
  add(6, 'CONTINUOUS');

  // Layer 4: SURFACE_TEXTE (Magenta - color 6)
  add(0, 'LAYER');
  add(2, 'SURFACE_TEXTE');
  add(70, 0);
  add(62, 6); // Magenta
  add(6, 'CONTINUOUS');

  add(0, 'ENDTAB');
  add(0, 'ENDSEC');

  // 3. SECTION ENTITIES
  add(0, 'SECTION');
  add(2, 'ENTITIES');

  if (n >= 2) {
    // A. Polygone fermé via POLYLINE et VERTEX
    add(0, 'POLYLINE');
    add(8, 'LIMITES_PARCELLE');
    add(66, 1); // Vertices follow
    add(70, n >= 3 ? 1 : 0); // 1 = Closed polygon, 0 = Open line

    for (let i = 0; i < n; i++) {
      add(0, 'VERTEX');
      add(8, 'LIMITES_PARCELLE');
      add(10, points[i].x.toFixed(4));
      add(20, points[i].y.toFixed(4));
      add(30, 0.0);
    }
    add(0, 'SEQEND');

    // B. Points de Bornes et noms
    for (let i = 0; i < n; i++) {
      const p = points[i];
      // Point
      add(0, 'POINT');
      add(8, 'BORNES_SOMMETS');
      add(10, p.x.toFixed(4));
      add(20, p.y.toFixed(4));
      add(30, 0.0);

      // Texte du nom de la borne
      add(0, 'TEXT');
      add(8, 'BORNES_SOMMETS');
      add(10, (p.x + 0.5).toFixed(4));
      add(20, (p.y + 0.5).toFixed(4));
      add(30, 0.0);
      add(40, 0.8); // Hauteur du texte en mètres
      add(1, utmMode ? `${p.name} (E:${p.x.toFixed(2)}, N:${p.y.toFixed(2)})` : `${p.name} (X:${p.x.toFixed(2)}, Y:${p.y.toFixed(2)})`);
    }

    // C. Cotations le long des arêtes
    for (const edge of edges) {
      add(0, 'TEXT');
      add(8, 'COTATIONS_METRIQUES');
      add(10, edge.midpoint.x.toFixed(4));
      add(20, edge.midpoint.y.toFixed(4));
      add(30, 0.0);
      add(40, 0.7); // Hauteur
      add(50, edge.angleDeg.toFixed(1)); // Rotation du texte le long du segment
      add(1, `${edge.length.toFixed(2)} m`);
    }

    // D. Cartouche central de surface au barycentre
    if (metrics.areaM2 > 0) {
      const cx = centroid.x;
      const cy = centroid.y;
      const agrarian = formatAgrarian(metrics.areaM2);

      add(0, 'TEXT');
      add(8, 'SURFACE_TEXTE');
      add(10, cx.toFixed(4));
      add(20, cy.toFixed(4));
      add(30, 0.0);
      add(40, 1.2); // Taille marquée
      add(1, `AIRE : ${metrics.areaM2.toFixed(2)} m²`);

      add(0, 'TEXT');
      add(8, 'SURFACE_TEXTE');
      add(10, cx.toFixed(4));
      add(20, (cy - 1.5).toFixed(4));
      add(30, 0.0);
      add(40, 0.9);
      add(1, `AGRAIRE : ${agrarian.formattedString}`);

      add(0, 'TEXT');
      add(8, 'SURFACE_TEXTE');
      add(10, cx.toFixed(4));
      add(20, (cy - 2.7).toFixed(4));
      add(30, 0.0);
      add(40, 0.7);
      add(1, `PERIMETRE : ${metrics.perimeterM.toFixed(2)} m`);
    }
  }

  add(0, 'ENDSEC');
  add(0, 'EOF');

  return lines.join('\n');
}

/**
 * Déclenche le téléchargement du fichier DXF ou le partage natif sur mobile.
 * Les coordonnées sont celles du repère métrique local du relevé (en mètres).
 */
export async function downloadOrShareDxf(
  project: AuditProject,
  metrics: CalculationResult,
  options: DxfOptions = {}
): Promise<boolean> {
  const blob = new Blob([generateDxfContent(project, metrics, options)], { type: 'application/dxf;charset=utf-8' });
  const suffix = options.coordinates === 'utm' ? '_utm' : '';
  return shareOrDownload(blob, `${safeFileName(project.title)}${suffix}.dxf`, 'application/dxf', {
    title: project.title,
    text: `Relevé de superficie Arpentis : ${project.title} (${metrics.areaM2.toFixed(2)} m²)`,
  });
}
