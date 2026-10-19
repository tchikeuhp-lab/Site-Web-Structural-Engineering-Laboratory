/** Provenance d'une borne : permet de ne jamais confondre mesure réelle, saisie et donnée de démonstration. */
export type PointSource = 'gnss' | 'manual' | 'local' | 'shape' | 'example' | 'simulated';

export interface Point2D {
  id: string;
  name: string; // Ex: "Borne 1", "P1", etc.
  x: number; // en mètres locaux
  y: number; // en mètres locaux
  // Coordonnées géodésiques WGS84 (présentes uniquement si le relevé est géoréférencé)
  lat?: number; // Latitude en degrés décimaux
  lon?: number; // Longitude en degrés décimaux
  altitude?: number; // Altitude en mètres
  gpsAccuracy?: number; // Précision horizontale annoncée en mètres (ex: ±1.8m)
  fixCount?: number; // Nombre de mesures de position moyennées
  timestamp?: number;
  source?: PointSource;
}

export interface EdgeMetric {
  fromId: string;
  toId: string;
  fromName: string;
  toName: string;
  length: number; // Longueur en mètres
  midpoint: { x: number; y: number };
  angleDeg: number; // Angle mathématique (depuis l'axe X, sens anti-horaire) — usage dessin
  gisementDeg: number; // Gisement topographique : depuis le Nord (axe Y), sens horaire
  interiorAngleDeg?: number; // Angle intérieur au sommet
}

export interface TriangleDecomposition {
  id: string;
  p1: Point2D;
  p2: Point2D;
  p3: Point2D;
  a: number; // Longueur côté 1
  b: number; // Longueur côté 2
  c: number; // Longueur côté 3
  area: number; // Aire calculée via Héron
}

export type AreaUnit = 'm2' | 'ha_a_ca' | 'ha' | 'a' | 'ca' | 'km2' | 'sqft' | 'acres';
export type CoordinateDisplayMode = 'metric' | 'gps_dd' | 'gps_dms';

export interface AuditProject {
  id: string;
  schemaVersion?: number;
  title: string;
  referenceCadastrale: string;
  operatorName: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
  points: Point2D[];
  unit: AreaUnit;
  coordinateMode: CoordinateDisplayMode;
  /**
   * Origine géodésique du repère métrique local (plan tangent).
   * Absente = relevé en coordonnées purement locales (non géoréférencé).
   */
  originGeodetic?: {
    lat: number;
    lon: number;
  };
}

export interface CalculationResult {
  areaM2: number;
  geodeticAreaM2?: number; // Aire calculée sur la sphère WGS84 (contrôle indicatif)
  perimeterM: number;
  centroid: { x: number; y: number };
  centroidGeodetic?: { lat: number; lon: number };
  edges: EdgeMetric[];
  triangles: TriangleDecomposition[];
  /** Vrai si la somme des triangles de Héron égale l'aire de Gauss (contrôle croisé réussi). */
  triangulationComplete: boolean;
  isSelfIntersecting: boolean;
  isClockwise: boolean;
  isValidPolygon: boolean;
  validationMessage: string;
}

export interface GpsSample {
  lat: number;
  lon: number;
  accuracy: number;
  altitude?: number | null;
  timestamp: number;
}
