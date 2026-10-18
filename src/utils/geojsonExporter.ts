import { AuditProject, CalculationResult } from '../types/survey';
import { getPointGeodetic } from './projectGeo';
import { safeFileName, shareOrDownload } from './download';

export class NotGeoreferencedError extends Error {
  constructor() {
    super(
      'Ce relevé est en coordonnées locales : il n’est pas géoréférencé. Utilisez au moins une borne GNSS ou saisie en latitude/longitude pour exporter vers un SIG.'
    );
    this.name = 'NotGeoreferencedError';
  }
}

/** Points avec lat/lon, ou lève NotGeoreferencedError si le relevé n'est pas géoréférencé. */
export function geodeticPointsOrThrow(project: AuditProject) {
  const origin = project.originGeodetic;
  return project.points.map((p) => {
    const geo = getPointGeodetic(p, origin);
    if (!geo) throw new NotGeoreferencedError();
    return { ...p, lat: geo.lat, lon: geo.lon };
  });
}

/**
 * Génère un fichier GeoJSON (RFC 7946, WGS84, ordre [lon, lat]).
 */
export function generateGeoJsonContent(project: AuditProject, metrics: CalculationResult): string {
  const points = project.points;
  const geodeticPoints = geodeticPointsOrThrow(project);

  // Anneau fermé (premier et dernier point identiques)
  const coordinatesRing: [number, number][] = geodeticPoints.map((p) => [p.lon, p.lat]);
  if (coordinatesRing.length >= 3) {
    coordinatesRing.push([coordinatesRing[0][0], coordinatesRing[0][1]]);
  }

  const features: unknown[] = [];

  if (coordinatesRing.length >= 4) {
    features.push({
      type: 'Feature',
      geometry: { type: 'Polygon', coordinates: [coordinatesRing] },
      properties: {
        nom: project.title,
        reference_cadastrale: project.referenceCadastrale,
        superficie_m2: metrics.areaM2,
        superficie_ha: Number((metrics.areaM2 / 10000).toFixed(4)),
        perimetre_m: metrics.perimeterM,
        nb_bornes: points.length,
        date_releve: project.updatedAt,
        operateur: project.operatorName,
      },
    });
  }

  geodeticPoints.forEach((p, i) => {
    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [p.lon, p.lat, p.altitude ?? 0] },
      properties: {
        borne_index: i + 1,
        nom: p.name,
        x_local_m: p.x,
        y_local_m: p.y,
        latitude: p.lat,
        longitude: p.lon,
        altitude: p.altitude,
        precision_gps_m: p.gpsAccuracy,
        echantillons_gnss: p.fixCount,
        source: p.source,
      },
    });
  });

  return JSON.stringify(
    { type: 'FeatureCollection', name: project.title, features },
    null,
    2
  );
}

export async function downloadOrShareGeoJson(
  project: AuditProject,
  metrics: CalculationResult
): Promise<boolean> {
  const content = generateGeoJsonContent(project, metrics);
  const blob = new Blob([content], { type: 'application/geo+json;charset=utf-8' });
  return shareOrDownload(blob, `${safeFileName(project.title)}.geojson`, 'application/geo+json', {
    title: `GeoJSON : ${project.title}`,
    text: `Emprise géoréférencée de la parcelle ${project.title}`,
  });
}
