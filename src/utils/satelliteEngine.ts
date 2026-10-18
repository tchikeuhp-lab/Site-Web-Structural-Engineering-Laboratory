import { GpsSample } from '../types/survey';

// Constantes de l'ellipsoïde WGS 84 (EPSG:4326)
export const WGS84_A = 6378137.0; // Demi-grand axe équatorial en mètres
export const WGS84_F = 1 / 298.257223563; // Aplatissement
export const WGS84_E2 = 2 * WGS84_F - WGS84_F * WGS84_F; // Première excentricité au carré (~0.00669438)
export const WGS84_R_MEAN = 6371008.8; // Rayon moyen volumétrique en mètres

/**
 * Calcule le rayon de courbure méridien RM et le rayon du premier vertical RN pour une latitude donnée
 */
export function getWgs84Radii(latDeg: number): { rm: number; rn: number } {
  const phi = (latDeg * Math.PI) / 180;
  const sinPhi = Math.sin(phi);
  const sin2Phi = sinPhi * sinPhi;
  const denom = Math.sqrt(1 - WGS84_E2 * sin2Phi);

  const rn = WGS84_A / denom;
  const rm = (WGS84_A * (1 - WGS84_E2)) / Math.pow(denom, 3);

  return { rm, rn };
}

/**
 * Projette des coordonnées géodésiques WGS84 (lat, lon) vers des coordonnées métriques locales (x, y)
 * relatives à un point d'origine (originLat, originLon) via un plan tangent ENU (East-North-Up)
 */
export function geodeticToMetric(
  lat: number,
  lon: number,
  originLat: number,
  originLon: number
): { x: number; y: number } {
  const { rm, rn } = getWgs84Radii(originLat);
  const latRad0 = (originLat * Math.PI) / 180;

  const dLatRad = ((lat - originLat) * Math.PI) / 180;
  const dLonRad = ((lon - originLon) * Math.PI) / 180;

  const x = dLonRad * rn * Math.cos(latRad0);
  const y = dLatRad * rm;

  return {
    x: Number(x.toFixed(3)),
    y: Number(y.toFixed(3)),
  };
}

/**
 * Convertit des coordonnées métriques locales (x, y) vers des coordonnées géodésiques WGS84 (lat, lon)
 */
export function metricToGeodetic(
  x: number,
  y: number,
  originLat: number,
  originLon: number
): { lat: number; lon: number } {
  const { rm, rn } = getWgs84Radii(originLat);
  const latRad0 = (originLat * Math.PI) / 180;

  const dLatRad = y / rm;
  const dLonRad = x / (rn * Math.cos(latRad0));

  const lat = originLat + (dLatRad * 180) / Math.PI;
  const lon = originLon + (dLonRad * 180) / Math.PI;

  return {
    lat: Number(lat.toFixed(7)),
    lon: Number(lon.toFixed(7)),
  };
}

/**
 * Convertit une valeur de degré décimal en objet DMS { deg, min, sec, dir }
 */
export function decimalToDms(val: number, isLatitude: boolean): {
  deg: number;
  min: number;
  sec: number;
  dir: string;
} {
  const dir = isLatitude ? (val >= 0 ? 'N' : 'S') : val >= 0 ? 'E' : 'W';
  const absVal = Math.abs(val);

  const deg = Math.floor(absVal);
  const minFloat = (absVal - deg) * 60;
  const min = Math.floor(minFloat);
  const sec = Number(((minFloat - min) * 60).toFixed(2));

  return { deg, min, sec, dir };
}

/**
 * Formate des coordonnées Latitude / Longitude en chaîne DMS claire
 * Ex: 48° 51' 23.82" N, 2° 21' 07.98" E
 */
export function formatDms(lat: number, lon: number): string {
  const latDms = decimalToDms(lat, true);
  const lonDms = decimalToDms(lon, false);

  const latStr = `${latDms.deg}° ${latDms.min}' ${latDms.sec.toFixed(2)}" ${latDms.dir}`;
  const lonStr = `${lonDms.deg}° ${lonDms.min}' ${lonDms.sec.toFixed(2)}" ${lonDms.dir}`;

  return `${latStr}, ${lonStr}`;
}

/**
 * Parse une saisie en DMS ou DD et retourne { lat, lon }
 */
export function parseCoordinatesString(input: string): { lat: number; lon: number } | null {
  const clean = input.trim();
  if (!clean) return null;

  // Format DD classique : "48.8566, 2.3522" ou "48.8566; 2.3522"
  const ddMatch = clean.match(/^([-+]?[0-9]*\.?[0-9]+)[\s,;]+([-+]?[0-9]*\.?[0-9]+)$/);
  if (ddMatch) {
    const lat = parseFloat(ddMatch[1]);
    const lon = parseFloat(ddMatch[2]);
    if (lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
      return { lat, lon };
    }
  }

  return null;
}

/**
 * Calcule la superficie d'un polygone sphéroïdal via l'algorithme de Chamberlain-Duquette (NASA/JPL)
 * sur les coordonnées angulaires (lat, lon en degrés)
 */
export function calculateChamberlainDuquetteArea(coords: { lat: number; lon: number }[]): number {
  const n = coords.length;
  if (n < 3) return 0;

  let total = 0;
  for (let i = 0; i < n; i++) {
    const prev = coords[(i - 1 + n) % n];
    const curr = coords[i];
    const next = coords[(i + 1) % n];

    const dLon = ((next.lon - prev.lon) * Math.PI) / 180;
    const sinLat = Math.sin((curr.lat * Math.PI) / 180);

    total += dLon * sinLat;
  }

  const areaM2 = (WGS84_R_MEAN * WGS84_R_MEAN * Math.abs(total)) / 2;
  return Number(areaM2.toFixed(2));
}

/**
 * MOYENNAGE GNSS PONDÉRÉ AVEC REJET DES ABERRATIONS
 *
 * - Pondération de chaque fixe par l'inverse de la variance déclarée par le récepteur (1/σ²).
 * - Rejet des échantillons trop éloignés du centroïde provisoire (multi-trajet) :
 *   seuil = max(3 m, moyenne + 2 écarts-types des distances).
 * - Précision rapportée : on ne revendique JAMAIS mieux que (a) le meilleur fixe déclaré par
 *   le récepteur ni (b) la dispersion réellement observée. Des fixes successifs sont corrélés :
 *   la formule σ/√n d'échantillons indépendants surestimerait la précision.
 */
export function processGpsSamples(samples: GpsSample[]): {
  lat: number;
  lon: number;
  altitude: number;
  accuracy: number;
  count: number;
} | null {
  if (!samples || samples.length === 0) return null;

  if (samples.length === 1) {
    return {
      lat: samples[0].lat,
      lon: samples[0].lon,
      altitude: samples[0].altitude || 0,
      accuracy: samples[0].accuracy,
      count: 1,
    };
  }

  const weightOf = (s: GpsSample) => {
    const sigma = Math.max(0.3, s.accuracy); // plancher de pondération (évite 1/0)
    return 1 / (sigma * sigma);
  };

  const weightedMean = (subset: GpsSample[]) => {
    let sumW = 0;
    let sumLat = 0;
    let sumLon = 0;
    let sumAlt = 0;
    for (const s of subset) {
      const w = weightOf(s);
      sumW += w;
      sumLat += w * s.lat;
      sumLon += w * s.lon;
      sumAlt += w * (s.altitude || 0);
    }
    return { lat: sumLat / sumW, lon: sumLon / sumW, alt: sumAlt / sumW };
  };

  const distanceM = (s: GpsSample, lat0: number, lon0: number) => {
    const { rm, rn } = getWgs84Radii(lat0);
    const dLatM = (((s.lat - lat0) * Math.PI) / 180) * rm;
    const dLonM = (((s.lon - lon0) * Math.PI) / 180) * rn * Math.cos((lat0 * Math.PI) / 180);
    return Math.hypot(dLatM, dLonM);
  };

  // 1. Centroïde provisoire pondéré
  const provisional = weightedMean(samples);

  // 2. Rejet des aberrations
  const distances = samples.map((s) => distanceM(s, provisional.lat, provisional.lon));
  const meanDist = distances.reduce((acc, d) => acc + d, 0) / distances.length;
  const stdDist = Math.sqrt(
    distances.reduce((acc, d) => acc + Math.pow(d - meanDist, 2), 0) / distances.length
  );
  const threshold = Math.max(3.0, meanDist + 2 * stdDist);
  let valid = samples.filter((_, i) => distances[i] <= threshold);
  if (valid.length === 0) valid = samples;

  // 3. Moyenne finale et précision prudente
  const final = weightedMean(valid);
  const rms = Math.sqrt(
    valid.reduce((acc, s) => acc + Math.pow(distanceM(s, final.lat, final.lon), 2), 0) / valid.length
  );
  const bestDeclared = Math.min(...valid.map((s) => s.accuracy));

  return {
    lat: Number(final.lat.toFixed(7)),
    lon: Number(final.lon.toFixed(7)),
    altitude: Number(final.alt.toFixed(1)),
    accuracy: Number(Math.max(bestDeclared, rms).toFixed(2)),
    count: valid.length,
  };
}
