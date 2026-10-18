/**
 * Projection UTM (Universal Transverse Mercator) sur l'ellipsoïde WGS 84.
 * Séries de Krüger (précision sub-millimétrique dans un fuseau de 6°).
 *
 * Cameroun : fuseaux 32N (6°E–12°E, ex. Yaoundé, Douala) et 33N (12°E–18°E).
 * Note : ces coordonnées sont en WGS 84 / UTM (EPSG:326xx). Les plans cadastraux
 * locaux peuvent s'appuyer sur un autre datum (ex. Minna) : à confirmer avec le service
 * du cadastre avant toute reprise de coordonnées dans un dossier officiel.
 */
const A = 6378137.0;
const F = 1 / 298.257223563;
const K0 = 0.9996;
const E0 = 500000;
const N0_SOUTH = 10000000;

const n = F / (2 - F);
const n2 = n * n;
const n3 = n2 * n;
const n4 = n3 * n;
const A_RECT = (A / (1 + n)) * (1 + n2 / 4 + n4 / 64);

const ALPHA = [
  n / 2 - (2 * n2) / 3 + (5 * n3) / 16 + (41 * n4) / 180,
  (13 * n2) / 48 - (3 * n3) / 5 + (557 * n4) / 1440,
  (61 * n3) / 240 - (103 * n4) / 140,
  (49561 * n4) / 161280,
];
const BETA = [
  n / 2 - (2 * n2) / 3 + (37 * n3) / 96 - n4 / 360,
  n2 / 48 + n3 / 15 - (437 * n4) / 1440,
  (17 * n3) / 480 - (37 * n4) / 840,
  (4397 * n4) / 161280,
];
const DELTA = [2 * n - (2 * n2) / 3 - 2 * n3, (7 * n2) / 3 - (8 * n3) / 5, (56 * n3) / 15];

const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

export interface UtmCoordinate {
  zone: number;
  hemisphere: 'N' | 'S';
  easting: number;
  northing: number;
  /** Code EPSG WGS 84 / UTM correspondant (326xx nord, 327xx sud) */
  epsg: number;
}

export function utmZoneFromLon(lon: number): number {
  const normalized = ((((lon + 180) % 360) + 360) % 360) - 180;
  return Math.min(60, Math.max(1, Math.floor((normalized + 180) / 6) + 1));
}

/** Convertit (lat, lon) WGS84 en UTM. `forcedZone` permet d'imposer un fuseau (ex. travailler en 32N à cheval). */
export function toUtm(lat: number, lon: number, forcedZone?: number): UtmCoordinate {
  const zone = forcedZone ?? utmZoneFromLon(lon);
  const lon0 = rad(zone * 6 - 183);
  const phi = rad(lat);
  const lam = rad(lon) - lon0;

  const sq = (2 * Math.sqrt(n)) / (1 + n);
  const t = Math.sinh(Math.atanh(Math.sin(phi)) - sq * Math.atanh(sq * Math.sin(phi)));

  const xiP = Math.atan2(t, Math.cos(lam));
  const etaP = Math.atanh(Math.sin(lam) / Math.sqrt(1 + t * t));

  let xi = xiP;
  let eta = etaP;
  for (let j = 1; j <= 4; j++) {
    xi += ALPHA[j - 1] * Math.sin(2 * j * xiP) * Math.cosh(2 * j * etaP);
    eta += ALPHA[j - 1] * Math.cos(2 * j * xiP) * Math.sinh(2 * j * etaP);
  }

  const hemisphere = lat >= 0 ? 'N' : 'S';
  return {
    zone,
    hemisphere,
    easting: E0 + K0 * A_RECT * eta,
    northing: (hemisphere === 'S' ? N0_SOUTH : 0) + K0 * A_RECT * xi,
    epsg: (hemisphere === 'N' ? 32600 : 32700) + zone,
  };
}

/** Convertit une coordonnée UTM en (lat, lon) WGS84. */
export function fromUtm(utm: Pick<UtmCoordinate, 'zone' | 'hemisphere' | 'easting' | 'northing'>): {
  lat: number;
  lon: number;
} {
  const xi = (utm.northing - (utm.hemisphere === 'S' ? N0_SOUTH : 0)) / (K0 * A_RECT);
  const eta = (utm.easting - E0) / (K0 * A_RECT);

  let xiP = xi;
  let etaP = eta;
  for (let j = 1; j <= 4; j++) {
    xiP -= BETA[j - 1] * Math.sin(2 * j * xi) * Math.cosh(2 * j * eta);
    etaP -= BETA[j - 1] * Math.cos(2 * j * xi) * Math.sinh(2 * j * eta);
  }

  const chi = Math.asin(Math.sin(xiP) / Math.cosh(etaP));
  let phi = chi;
  for (let j = 1; j <= 3; j++) {
    phi += DELTA[j - 1] * Math.sin(2 * j * chi);
  }
  const lam = Math.atan2(Math.sinh(etaP), Math.cos(xiP));

  return { lat: deg(phi), lon: deg(rad(utm.zone * 6 - 183) + lam) };
}

export function formatUtm(u: UtmCoordinate): string {
  return `${u.zone}${u.hemisphere}  E ${u.easting.toFixed(2)}  N ${u.northing.toFixed(2)}`;
}
