import { describe, expect, it } from 'vitest';
import {
  calculateGisement,
  computeSurveyMetrics,
  formatAgrarian,
  generateCanonicalShape,
  triangulatePolygon,
} from '../geometryEngine';
import { Point2D } from '../../types/survey';

const mk = (coords: number[][]): Point2D[] =>
  coords.map((c, i) => ({ id: `p${i}`, name: `P${i}`, x: c[0], y: c[1] }));

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

describe('aire, périmètre', () => {
  it('rectangle 30 x 20', () => {
    const m = computeSurveyMetrics(mk([[0, 0], [30, 0], [30, 20], [0, 20]]));
    expect(m.areaM2).toBeCloseTo(600, 9);
    expect(m.perimeterM).toBeCloseTo(100, 9);
    expect(m.isValidPolygon).toBe(true);
  });

  it('trapèze (grande base 40, petite base 20, hauteur 25) = 750 m²', () => {
    const shape = generateCanonicalShape('trapezoid', { base1: 40, base2: 20, height: 25 });
    expect(computeSurveyMetrics(shape).areaM2).toBeCloseTo(750, 9);
  });

  it("l'aire ne dépend pas du sens de parcours", () => {
    const poly = [[-15, -15], [25, -18], [30, 15], [5, 22], [-18, 12]];
    const a = computeSurveyMetrics(mk(poly)).areaM2;
    const b = computeSurveyMetrics(mk([...poly].reverse())).areaM2;
    expect(a).toBeCloseTo(b, 9);
    expect(a).toBeCloseTo(1525.5, 6);
  });

  it('détecte un polygone croisé (papillon)', () => {
    const m = computeSurveyMetrics(mk([[0, 0], [10, 10], [10, 0], [0, 10]]));
    expect(m.isSelfIntersecting).toBe(true);
    expect(m.triangles).toHaveLength(0);
    expect(m.triangulationComplete).toBe(false);
  });
});

describe('angles intérieurs', () => {
  const poly = [[-15, -15], [25, -18], [30, 15], [5, 22], [-18, 12]];

  it.each([
    ['anti-horaire', poly],
    ['horaire', [...poly].reverse()],
  ])('somme = (n-2)·180° — polygone %s', (_label, coords) => {
    const m = computeSurveyMetrics(mk(coords as number[][]));
    const total = sum(m.edges.map((e) => e.interiorAngleDeg ?? 0));
    expect(total).toBeCloseTo(540, 6);
  });

  it('carré : 4 angles de 90° dans les deux sens', () => {
    for (const coords of [[[0, 0], [10, 0], [10, 10], [0, 10]], [[0, 10], [10, 10], [10, 0], [0, 0]]]) {
      const m = computeSurveyMetrics(mk(coords));
      m.edges.forEach((e) => expect(e.interiorAngleDeg).toBeCloseTo(90, 9));
    }
  });

  it('polygone concave en L : un angle réflexe de 270°', () => {
    const m = computeSurveyMetrics(mk([[0, 0], [20, 0], [20, 10], [10, 10], [10, 20], [0, 20]]));
    const angles = m.edges.map((e) => Math.round(e.interiorAngleDeg ?? 0)).sort((a, b) => a - b);
    expect(angles).toEqual([90, 90, 90, 90, 90, 270]);
    expect(sum(angles)).toBe(720);
  });
});

describe('gisement topographique (depuis le Nord, sens horaire)', () => {
  const o = { id: 'o', name: 'O', x: 0, y: 0 };
  const at = (x: number, y: number) => ({ id: 'q', name: 'Q', x, y });
  it('Nord = 0°, Est = 90°, Sud = 180°, Ouest = 270°', () => {
    expect(calculateGisement(o, at(0, 10))).toBeCloseTo(0, 9);
    expect(calculateGisement(o, at(10, 0))).toBeCloseTo(90, 9);
    expect(calculateGisement(o, at(0, -10))).toBeCloseTo(180, 9);
    expect(calculateGisement(o, at(-10, 0))).toBeCloseTo(270, 9);
  });
});

describe('triangulation (contrôle croisé de Héron)', () => {
  const cases: Record<string, number[][]> = {
    carré: [[0, 0], [10, 0], [10, 10], [0, 10]],
    'U concave': [[0, 0], [10, 0], [10, 10], [7, 10], [7, 3], [3, 3], [3, 10], [0, 10]],
    'peigne (3 dents)': [[0, 0], [15, 0], [15, 10], [13, 10], [13, 4], [11, 4], [11, 10], [9, 10], [9, 4], [7, 4], [7, 10], [5, 10], [5, 4], [3, 4], [3, 10], [0, 10]],
    'borne alignée sur un côté': [[0, 0], [5, 0], [10, 0], [10, 10], [0, 10]],
    'plusieurs bornes alignées': [[0, 0], [3, 0], [6, 0], [10, 0], [10, 5], [10, 10], [0, 10]],
  };

  it.each(Object.entries(cases))('%s : somme des triangles = aire de Gauss', (_n, coords) => {
    for (const c of [coords, [...coords].reverse()]) {
      const m = computeSurveyMetrics(mk(c));
      expect(m.triangulationComplete).toBe(true);
      expect(sum(m.triangles.map((t) => t.area))).toBeCloseTo(m.areaM2, 6);
    }
  });

  it('ne renvoie jamais de triangles dont la somme diffère de l’aire (sinon tableau vide)', () => {
    const shapes = [
      [[0, 0], [10, 10], [10, 0], [0, 10]],
      [[0, 0], [5, 5], [10, 10], [3, 7], [0, 10]],
    ];
    for (const c of shapes) {
      const pts = mk(c);
      const tris = triangulatePolygon(pts);
      const m = computeSurveyMetrics(pts);
      if (tris.length > 0 && !m.isSelfIntersecting) {
        expect(sum(tris.map((t) => t.area))).toBeCloseTo(m.areaM2, 6);
      }
      expect(m.triangulationComplete && m.isSelfIntersecting).toBe(false);
    }
  });
});

describe('format agraire', () => {
  it.each([
    [0, '0.00 ca'],
    [99.999, '1 a 0.00 ca'],
    [100, '1 a 0.00 ca'],
    [1525.5, '15 a 25.50 ca'],
    [9999.999, '1 ha 0 a 0.00 ca'],
    [10000, '1 ha 0 a 0.00 ca'],
    [123456.789, '12 ha 34 a 56.79 ca'],
  ])('%s m² → %s', (area, expected) => {
    expect(formatAgrarian(area).formattedString).toBe(expected);
  });

  it('ne produit jamais « 100.00 ca »', () => {
    for (let a = 0; a < 20000; a += 0.37) {
      expect(formatAgrarian(a).formattedString).not.toContain('100.00 ca');
    }
  });
});
