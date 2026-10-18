import { CalculationResult, EdgeMetric, Point2D, TriangleDecomposition, AreaUnit } from '../types/survey';

/**
 * Calcule la distance euclidienne entre deux points en mètres
 */
export function calculateDistance(p1: Point2D, p2: Point2D): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.hypot(dx, dy);
}

/**
 * Calcule l'angle d'orientation (en degrés) d'un vecteur p1 -> p2
 */
export function calculateBearing(p1: Point2D, p2: Point2D): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  let angle = Math.atan2(dy, dx) * (180 / Math.PI);
  if (angle < 0) angle += 360;
  return angle;
}

/**
 * Gisement topographique (en degrés, [0, 360[) du vecteur p1 -> p2 :
 * angle mesuré depuis le Nord (axe +Y), dans le sens horaire.
 */
export function calculateGisement(p1: Point2D, p2: Point2D): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  let angle = Math.atan2(dx, dy) * (180 / Math.PI);
  if (angle < 0) angle += 360;
  return angle;
}

/**
 * Calcule l'angle intérieur au sommet `curr` entre les arêtes prev->curr et curr->next.
 * `isClockwise` est le sens de parcours du polygone : l'intérieur se trouve à droite du
 * cheminement pour un polygone horaire, à gauche pour un polygone anti-horaire.
 */
export function calculateInteriorAngle(
  prev: Point2D,
  curr: Point2D,
  next: Point2D,
  isClockwise: boolean
): number {
  const v1x = prev.x - curr.x;
  const v1y = prev.y - curr.y;
  const v2x = next.x - curr.x;
  const v2y = next.y - curr.y;

  const dot = v1x * v2x + v1y * v2y;
  const cross = v1x * v2y - v1y * v2x;
  // Angle balayé en tournant (sens anti-horaire) de curr->prev vers curr->next
  let ccw = Math.atan2(cross, dot) * (180 / Math.PI);
  if (ccw < 0) ccw += 360;
  // Polygone horaire : cet angle est l'angle intérieur ; anti-horaire : c'est son complément à 360°
  return isClockwise ? ccw : (360 - ccw) % 360;
}

/**
 * Vérifie si deux segments [p1, p2] et [p3, p4] s'intersectent strictement
 */
export function doSegmentsIntersect(
  p1: Point2D,
  p2: Point2D,
  p3: Point2D,
  p4: Point2D
): boolean {
  // Fonction d'orientation CCW
  const ccw = (a: Point2D, b: Point2D, c: Point2D): number => {
    return (c.y - a.y) * (b.x - a.x) - (b.y - a.y) * (c.x - a.x);
  };

  const d1 = ccw(p3, p4, p1);
  const d2 = ccw(p3, p4, p2);
  const d3 = ccw(p1, p2, p3);
  const d4 = ccw(p1, p2, p4);

  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
      ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) {
    return true;
  }

  return false;
}

/**
 * Vérifie si un polygone présente des auto-intersections entre ses arêtes
 */
export function checkSelfIntersection(points: Point2D[]): boolean {
  const n = points.length;
  if (n < 4) return false;

  for (let i = 0; i < n; i++) {
    const p1 = points[i];
    const p2 = points[(i + 1) % n];

    for (let j = i + 2; j < n; j++) {
      // Les segments consécutifs partagent un sommet et ne s'auto-intersectent pas strictement
      if (i === 0 && j === n - 1) continue;

      const p3 = points[j];
      const p4 = points[(j + 1) % n];

      if (doSegmentsIntersect(p1, p2, p3, p4)) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Calcule la superficie exacte d'un polygone par la Formule de Gauss (Shoelace Formula)
 * Retourne l'aire en mètres carrés (m²) et le sens d'orientation (horaire / anti-horaire)
 */
export function calculateShoelaceArea(points: Point2D[]): { areaM2: number; isClockwise: boolean } {
  const n = points.length;
  if (n < 3) return { areaM2: 0, isClockwise: false };

  let sum = 0;
  for (let i = 0; i < n; i++) {
    const pCurrent = points[i];
    const pNext = points[(i + 1) % n];
    sum += (pCurrent.x * pNext.y) - (pNext.x * pCurrent.y);
  }

  const isClockwise = sum < 0;
  const areaM2 = Math.abs(sum) / 2;
  return { areaM2, isClockwise };
}

/**
 * Calcule le centre de gravité (barycentre / centroïde géométrique) d'un polygone
 */
export function calculateCentroid(points: Point2D[]): { x: number; y: number } {
  const n = points.length;
  if (n === 0) return { x: 0, y: 0 };
  if (n === 1) return { x: points[0].x, y: points[0].y };
  if (n === 2) return { x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 };

  let cx = 0;
  let cy = 0;
  let signedArea = 0;

  for (let i = 0; i < n; i++) {
    const p0 = points[i];
    const p1 = points[(i + 1) % n];
    const a = (p0.x * p1.y) - (p1.x * p0.y);
    signedArea += a;
    cx += (p0.x + p1.x) * a;
    cy += (p0.y + p1.y) * a;
  }

  signedArea *= 0.5;

  if (Math.abs(signedArea) < 1e-7) {
    // Cas dégénéré (points colinéaires) : moyenne arithmétique simple
    const avgX = points.reduce((acc, p) => acc + p.x, 0) / n;
    const avgY = points.reduce((acc, p) => acc + p.y, 0) / n;
    return { x: avgX, y: avgY };
  }

  cx = cx / (6 * signedArea);
  cy = cy / (6 * signedArea);

  return { x: cx, y: cy };
}

/**
 * Calcule l'aire d'un triangle via la formule de Héron à partir des coordonnées de ses 3 sommets
 */
export function calculateHeronTriangle(p1: Point2D, p2: Point2D, p3: Point2D): TriangleDecomposition {
  const a = calculateDistance(p1, p2);
  const b = calculateDistance(p2, p3);
  const c = calculateDistance(p3, p1);

  const s = (a + b + c) / 2;
  const radicand = Math.max(0, s * (s - a) * (s - b) * (s - c));
  const area = Math.sqrt(radicand);

  return {
    id: `tri-${p1.id}-${p2.id}-${p3.id}`,
    p1,
    p2,
    p3,
    a,
    b,
    c,
    area,
  };
}

/**
 * Décompose un polygone simple en triangles par l'algorithme d'Ear-Clipping (coupe d'oreilles).
 *
 * Retourne un tableau vide si la triangulation ne peut pas être menée à son terme
 * (polygone auto-intersectant, dégénéré…) : on ne renvoie jamais une décomposition partielle,
 * dont la somme ne serait pas égale à l'aire du polygone.
 * Les sommets alignés (borne intermédiaire sur un côté droit) sont absorbés sans créer de triangle.
 */
export function triangulatePolygon(points: Point2D[]): TriangleDecomposition[] {
  const n = points.length;
  if (n < 3) return [];
  if (n === 3) {
    return [calculateHeronTriangle(points[0], points[1], points[2])];
  }

  // L'algorithme travaille en sens anti-horaire
  const pts = [...points];
  const { isClockwise } = calculateShoelaceArea(pts);
  if (isClockwise) {
    pts.reverse();
  }

  const cross = (a: Point2D, b: Point2D, c: Point2D) =>
    (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);

  // Tolérance proportionnelle à l'échelle du polygone (évite les seuils absolus fragiles)
  let scale = 0;
  for (const p of pts) scale = Math.max(scale, Math.abs(p.x), Math.abs(p.y));
  const eps = Math.max(1e-9, scale * scale * 1e-12);

  // Point dans le triangle (a, b, c orienté anti-horaire), frontière incluse
  const isPointInTriangle = (p: Point2D, a: Point2D, b: Point2D, c: Point2D): boolean =>
    cross(a, b, p) >= -eps && cross(b, c, p) >= -eps && cross(c, a, p) >= -eps;

  const triangles: TriangleDecomposition[] = [];
  const indices = pts.map((_, i) => i);

  let guard = n * n + 10;
  while (indices.length > 3 && guard-- > 0) {
    let progressed = false;

    for (let i = 0; i < indices.length; i++) {
      const prevIdx = indices[(i - 1 + indices.length) % indices.length];
      const currIdx = indices[i];
      const nextIdx = indices[(i + 1) % indices.length];

      const a = pts[prevIdx];
      const b = pts[currIdx];
      const c = pts[nextIdx];

      const turn = cross(a, b, c);

      // Sommet aligné : on le retire sans créer de triangle (aire nulle)
      if (Math.abs(turn) <= eps) {
        indices.splice(i, 1);
        progressed = true;
        break;
      }

      if (turn < 0) continue; // Sommet concave (réflexe)

      // Aucun autre sommet ne doit se trouver dans le triangle candidat
      let hasInsidePoint = false;
      for (let j = 0; j < indices.length; j++) {
        const testIdx = indices[j];
        if (testIdx === prevIdx || testIdx === currIdx || testIdx === nextIdx) continue;
        if (isPointInTriangle(pts[testIdx], a, b, c)) {
          hasInsidePoint = true;
          break;
        }
      }

      if (!hasInsidePoint) {
        triangles.push(calculateHeronTriangle(a, b, c));
        indices.splice(i, 1);
        progressed = true;
        break;
      }
    }

    if (!progressed) return []; // Impossible de terminer : pas de décomposition partielle
  }

  if (indices.length === 3) {
    triangles.push(calculateHeronTriangle(pts[indices[0]], pts[indices[1]], pts[indices[2]]));
    return triangles;
  }

  return [];
}

/**
 * Analyse complète et calcul géométrique du polygone
 */
export function computeSurveyMetrics(points: Point2D[]): CalculationResult {
  const n = points.length;

  if (n === 0) {
    return {
      areaM2: 0,
      perimeterM: 0,
      centroid: { x: 0, y: 0 },
      edges: [],
      triangles: [],
      triangulationComplete: false,
      isSelfIntersecting: false,
      isClockwise: false,
      isValidPolygon: false,
      validationMessage: 'Aucune borne définie. Touchez le bouton [+] pour ajouter la première borne.',
    };
  }

  if (n === 1) {
    return {
      areaM2: 0,
      perimeterM: 0,
      centroid: { x: points[0].x, y: points[0].y },
      edges: [],
      triangles: [],
      triangulationComplete: false,
      isSelfIntersecting: false,
      isClockwise: false,
      isValidPolygon: false,
      validationMessage: '1 borne positionnée. Ajoutez au moins 3 bornes pour former une superficie.',
    };
  }

  if (n === 2) {
    const dist = calculateDistance(points[0], points[1]);
    return {
      areaM2: 0,
      perimeterM: dist,
      centroid: { x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 },
      edges: [
        {
          fromId: points[0].id,
          toId: points[1].id,
          fromName: points[0].name,
          toName: points[1].name,
          length: dist,
          midpoint: { x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 },
          angleDeg: calculateBearing(points[0], points[1]),
          gisementDeg: calculateGisement(points[0], points[1]),
        },
      ],
      triangles: [],
      triangulationComplete: false,
      isSelfIntersecting: false,
      isClockwise: false,
      isValidPolygon: false,
      validationMessage: 'Segment linéaire (longueur : ' + dist.toFixed(2) + ' m). Ajoutez une 3ème borne pour fermer le polygone.',
    };
  }

  // n >= 3 : Polygone
  const { areaM2, isClockwise } = calculateShoelaceArea(points);
  const centroid = calculateCentroid(points);
  const isSelfIntersecting = checkSelfIntersection(points);

  // Arêtes et périmètre
  const edges: EdgeMetric[] = [];
  let perimeterM = 0;

  for (let i = 0; i < n; i++) {
    const pCurrent = points[i];
    const pNext = points[(i + 1) % n];
    const pPrev = points[(i - 1 + n) % n];

    const length = calculateDistance(pCurrent, pNext);
    perimeterM += length;

    const angleDeg = calculateBearing(pCurrent, pNext);
    const gisementDeg = calculateGisement(pCurrent, pNext);
    const interiorAngleDeg = calculateInteriorAngle(pPrev, pCurrent, pNext, isClockwise);

    edges.push({
      fromId: pCurrent.id,
      toId: pNext.id,
      fromName: pCurrent.name,
      toName: pNext.name,
      length,
      midpoint: {
        x: (pCurrent.x + pNext.x) / 2,
        y: (pCurrent.y + pNext.y) / 2,
      },
      angleDeg,
      gisementDeg,
      interiorAngleDeg,
    });
  }

  const triangles = isSelfIntersecting ? [] : triangulatePolygon(points);
  const trianglesSum = triangles.reduce((acc, t) => acc + t.area, 0);
  // Contrôle croisé : la somme des triangles de Héron doit égaler l'aire de Gauss
  const triangulationComplete =
    triangles.length > 0 && Math.abs(trianglesSum - areaM2) <= Math.max(1e-6, areaM2 * 1e-9);
  const isValidPolygon = !isSelfIntersecting && areaM2 > 0;

  let validationMessage = 'Polygone valide et régulier.';
  if (isSelfIntersecting) {
    validationMessage = 'Attention : les arêtes se croisent. La superficie calculée peut être erronée.';
  } else if (areaM2 <= 0.001) {
    validationMessage = 'Les bornes sont presque alignées (aire nulle). Déplacez une borne pour ouvrir la surface.';
  }

  return {
    areaM2,
    perimeterM,
    centroid,
    edges,
    triangles,
    triangulationComplete,
    isSelfIntersecting,
    isClockwise,
    isValidPolygon,
    validationMessage,
  };
}

/**
 * Décomposition d'une surface en unités agraires françaises : Hectares, Ares, Centiares
 * 1 hectare (ha) = 10 000 m²
 * 1 are (a) = 100 m²
 * 1 centiare (ca) = 1 m²
 */
export function formatAgrarian(areaM2: number): {
  ha: number;
  a: number;
  ca: number;
  caDecimals: number;
  formattedString: string;
} {
  // Arithmétique entière en centièmes de m² : arrondi unique, pas de « 100.00 ca » parasite
  const total = Math.round(Math.max(0, Number.isFinite(areaM2) ? areaM2 : 0) * 100);
  const ha = Math.floor(total / 1_000_000);
  const afterHa = total % 1_000_000;
  const a = Math.floor(afterHa / 10_000);
  const caHundredths = afterHa % 10_000; // centièmes de centiare restants (0 – 9999)
  const ca = Math.floor(caHundredths / 100);
  const caDecimals = (caHundredths % 100) / 100;

  let str = '';
  if (ha > 0) str += `${ha} ha `;
  if (a > 0 || ha > 0) str += `${a} a `;
  str += `${(caHundredths / 100).toFixed(2)} ca`;

  return {
    ha,
    a,
    ca,
    caDecimals,
    formattedString: str.trim(),
  };
}

/**
 * Formate une superficie selon l'unité de mesure choisie
 */
export function formatAreaValue(areaM2: number, unit: AreaUnit): string {
  switch (unit) {
    case 'ha_a_ca':
      return formatAgrarian(areaM2).formattedString;
    case 'ha':
      return `${(areaM2 / 10000).toLocaleString('fr-FR', { minimumFractionDigits: 4, maximumFractionDigits: 4 })} ha`;
    case 'a':
      return `${(areaM2 / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} a`;
    case 'ca':
      return `${areaM2.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ca`;
    case 'km2':
      return `${(areaM2 / 1000000).toLocaleString('fr-FR', { minimumFractionDigits: 6, maximumFractionDigits: 6 })} km²`;
    case 'sqft':
      // 1 m² = 10.7639 sq ft
      return `${(areaM2 * 10.76391).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} sq ft`;
    case 'acres':
      // 1 m² = 0.000247105 acres
      return `${(areaM2 * 0.000247105).toLocaleString('fr-FR', { minimumFractionDigits: 4, maximumFractionDigits: 4 })} acres`;
    case 'm2':
    default:
      return `${areaM2.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m²`;
  }
}

/**
 * Générateur de coordonnées pour formes canoniques
 */
export function generateCanonicalShape(
  type: 'rectangle' | 'triangle' | 'trapezoid' | 'circle' | 'regular_poly',
  params: {
    width?: number;
    height?: number;
    base1?: number;
    base2?: number;
    sides?: number;
    radius?: number;
    center?: { x: number; y: number };
  }
): Point2D[] {
  const cx = params.center?.x ?? 0;
  const cy = params.center?.y ?? 0;

  switch (type) {
    case 'rectangle': {
      const w = params.width ?? 30;
      const h = params.height ?? 20;
      return [
        { source: 'shape' as const, id: 'p-1', name: 'Borne A', x: cx - w / 2, y: cy - h / 2 },
        { source: 'shape' as const, id: 'p-2', name: 'Borne B', x: cx + w / 2, y: cy - h / 2 },
        { source: 'shape' as const, id: 'p-3', name: 'Borne C', x: cx + w / 2, y: cy + h / 2 },
        { source: 'shape' as const, id: 'p-4', name: 'Borne D', x: cx - w / 2, y: cy + h / 2 },
      ];
    }
    case 'triangle': {
      const b = params.width ?? 30;
      const h = params.height ?? 25;
      return [
        { source: 'shape' as const, id: 'p-1', name: 'Sommet A', x: cx, y: cy - (2 * h) / 3 },
        { source: 'shape' as const, id: 'p-2', name: 'Sommet B', x: cx + b / 2, y: cy + h / 3 },
        { source: 'shape' as const, id: 'p-3', name: 'Sommet C', x: cx - b / 2, y: cy + h / 3 },
      ];
    }
    case 'trapezoid': {
      const b1 = params.base1 ?? 40; // Grande base
      const b2 = params.base2 ?? 20; // Petite base
      const h = params.height ?? 25;
      return [
        { source: 'shape' as const, id: 'p-1', name: 'Borne A', x: cx - b2 / 2, y: cy - h / 2 },
        { source: 'shape' as const, id: 'p-2', name: 'Borne B', x: cx + b2 / 2, y: cy - h / 2 },
        { source: 'shape' as const, id: 'p-3', name: 'Borne C', x: cx + b1 / 2, y: cy + h / 2 },
        { source: 'shape' as const, id: 'p-4', name: 'Borne D', x: cx - b1 / 2, y: cy + h / 2 },
      ];
    }
    case 'regular_poly':
    case 'circle': {
      const sides = type === 'circle' ? 24 : Math.max(3, params.sides ?? 6);
      const r = params.radius ?? 20;
      const points: Point2D[] = [];
      for (let i = 0; i < sides; i++) {
        const angle = (i * 2 * Math.PI) / sides - Math.PI / 2;
        points.push({
          source: 'shape',
          id: `p-${i + 1}`,
          name: `P${i + 1}`,
          x: Number((cx + r * Math.cos(angle)).toFixed(2)),
          y: Number((cy + r * Math.sin(angle)).toFixed(2)),
        });
      }
      return points;
    }
    default:
      return [];
  }
}
