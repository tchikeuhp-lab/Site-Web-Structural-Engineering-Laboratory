import { AuditProject, Point2D } from '../types/survey';
import { geodeticToMetric, metricToGeodetic } from './satelliteEngine';

export type GeoOrigin = { lat: number; lon: number };

/** Distance maximale (m) entre l'origine d'un relevé et une borne : au-delà, le plan tangent local n'est plus fiable. */
export const MAX_RADIUS_FROM_ORIGIN_M = 20_000;

export const isGeoreferenced = (project: Pick<AuditProject, 'originGeodetic'>): boolean =>
  !!project.originGeodetic;

/** Coordonnées WGS84 d'une borne (stockées, ou déduites de x/y si le relevé est géoréférencé). */
export function getPointGeodetic(
  p: Point2D,
  origin?: GeoOrigin
): { lat: number; lon: number } | null {
  if (p.lat !== undefined && p.lon !== undefined) return { lat: p.lat, lon: p.lon };
  if (origin) return metricToGeodetic(p.x, p.y, origin.lat, origin.lon);
  return null;
}

/** Complète lat/lon à partir de x/y si une origine existe ; sinon retire toute donnée géodésique périmée. */
export function withGeodetic(p: Point2D, origin?: GeoOrigin): Point2D {
  if (!origin) {
    const { lat: _lat, lon: _lon, ...rest } = p;
    return rest;
  }
  const geo = metricToGeodetic(p.x, p.y, origin.lat, origin.lon);
  return { ...p, lat: geo.lat, lon: geo.lon };
}

/** Recalcule x/y d'une borne à partir de ses lat/lon et de l'origine. */
export function withMetric(p: Point2D, origin: GeoOrigin): Point2D {
  if (p.lat === undefined || p.lon === undefined) return p;
  const m = geodeticToMetric(p.lat, p.lon, origin.lat, origin.lon);
  return { ...p, x: m.x, y: m.y };
}

export function newId(prefix = 'p'): string {
  const rnd =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${prefix}-${Date.now().toString(36)}-${rnd}`;
}
