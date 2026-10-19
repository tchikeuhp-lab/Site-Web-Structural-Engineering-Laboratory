import { describe, expect, it } from 'vitest';
import { DxfUtmUnavailableError, generateDxfContent } from '../dxfExporter';
import { generateGeoJsonContent, NotGeoreferencedError } from '../geojsonExporter';
import { generateKmlContent } from '../kmlExporter';
import { generateCsvContent, csvCell } from '../csvExporter';
import { computeSurveyMetrics } from '../geometryEngine';
import { metricToGeodetic } from '../satelliteEngine';
import { safeFileName } from '../download';
import { toUtm } from '../utm';
import { chooseLayout, dxfAscii } from '../dxfSheet';
import { AuditProject, Point2D } from '../../types/survey';

const ORIGIN = { lat: 3.848, lon: 11.5021 };

function project(georef: boolean, coords = [[0, 0], [40, 0], [40, 30], [0, 30]]): AuditProject {
  const points: Point2D[] = coords.map(([x, y], i) => {
    const base: Point2D = { id: `p${i}`, name: `Borne É${i}`, x, y };
    if (!georef) return base;
    const g = metricToGeodetic(x, y, ORIGIN.lat, ORIGIN.lon);
    return { ...base, lat: g.lat, lon: g.lon };
  });
  return {
    id: 'x', title: 'Parcelle des Chênes', referenceCadastrale: '', operatorName: '', notes: '',
    createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-02T00:00:00Z', unit: 'm2', coordinateMode: 'metric',
    points, ...(georef ? { originGeodetic: ORIGIN } : {}),
  };
}

const vertices = (dxf: string) => {
  const l = dxf.split('\n');
  const out: number[][] = [];
  for (let i = 0; i < l.length; i++) {
    if (l[i] === 'VERTEX' && l[i + 2] === 'LIMITES_PARCELLE') {
      const x = l.indexOf('10', i); const y = l.indexOf('20', i);
      out.push([Number(l[x + 1]), Number(l[y + 1])]);
    }
  }
  return out;
};

describe('DXF', () => {
  it('local : sommets = coordonnées du relevé, ASCII pur', () => {
    const p = project(false);
    const dxf = generateDxfContent(p, computeSurveyMetrics(p.points));
    expect(vertices(dxf)).toEqual([[0, 0], [40, 0], [40, 30], [0, 30]]);
    expect(/^[\x20-\x7E\n]*$/.test(dxf)).toBe(true);
    expect(dxf).toContain('repere metrique local');
  });

  it('UTM : sommets = Est/Nord WGS84 du fuseau 32N, distances conservées', () => {
    const p = project(true);
    const m = computeSurveyMetrics(p.points);
    const v = vertices(generateDxfContent(p, m, { coordinates: 'utm' }));
    const expected = toUtm(ORIGIN.lat, ORIGIN.lon);
    expect(v[0][0]).toBeCloseTo(expected.easting, 2);
    expect(v[0][1]).toBeCloseTo(expected.northing, 2);
    // Côtés de 40 m et 30 m conservés à ~1 mm près (facteur d'échelle UTM ≈ 0,9996 sur le méridien central)
    expect(Math.hypot(v[1][0] - v[0][0], v[1][1] - v[0][1])).toBeCloseTo(40, 1);
    expect(Math.hypot(v[3][0] - v[0][0], v[3][1] - v[0][1])).toBeCloseTo(30, 1);
    expect(generateDxfContent(p, m, { coordinates: 'utm' })).toContain('EPSG:32632');
  });

  it('UTM refusé pour un relevé local', () => {
    const p = project(false);
    expect(() => generateDxfContent(p, computeSurveyMetrics(p.points), { coordinates: 'utm' })).toThrow(DxfUtmUnavailableError);
  });
});

describe('GeoJSON / KML', () => {
  it('refusés pour un relevé local', () => {
    const p = project(false);
    const m = computeSurveyMetrics(p.points);
    expect(() => generateGeoJsonContent(p, m)).toThrow(NotGeoreferencedError);
    expect(() => generateKmlContent(p, m)).toThrow(NotGeoreferencedError);
  });

  it('GeoJSON : anneau fermé [lon, lat]', () => {
    const p = project(true);
    const gj = JSON.parse(generateGeoJsonContent(p, computeSurveyMetrics(p.points)));
    const ring = gj.features[0].geometry.coordinates[0];
    expect(ring).toHaveLength(5);
    expect(ring[0]).toEqual(ring[4]);
    expect(ring[0][0]).toBeCloseTo(ORIGIN.lon, 6);
    expect(ring[0][1]).toBeCloseTo(ORIGIN.lat, 6);
  });

  it('KML : XML échappé, aucune URL externe', () => {
    const p = project(true);
    p.title = 'A & B <C>';
    const kml = generateKmlContent(p, computeSurveyMetrics(p.points));
    expect(kml).toContain('A &amp; B &lt;C&gt;');
    expect(kml).not.toMatch(/https?:\/\/(?!www\.opengis)/);
  });
});

describe('CSV', () => {
  it('neutralise l’injection de formule et protège les séparateurs', () => {
    expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(csvCell('@cmd')).toBe("'@cmd");
    expect(csvCell('a;b')).toBe('"a;b"');
    expect(csvCell(-12.5)).toBe('-12.5');
  });

  it('contient UTM et gisement pour un relevé géoréférencé, rien d’inventé pour un relevé local', () => {
    const g = project(true);
    expect(generateCsvContent(g, computeSurveyMetrics(g.points))).toContain('32N');
    const l = project(false);
    const csv = generateCsvContent(l, computeSurveyMetrics(l.points));
    expect(csv).not.toContain('32N');
    expect(csv).toContain('Coordonnées locales');
  });
});

describe('noms de fichier', () => {
  it('conserve les accents, retire les caractères interdits', () => {
    expect(safeFileName('Parcelle des Chênes (Lot 4)')).toBe('Parcelle_des_Chênes_(Lot_4)');
    expect(safeFileName('a/b:c*?"<>|d')).toBe('abcd');
    expect(safeFileName('')).toBe('releve');
  });
});

describe('DXF : cadre et cartouche normalisés', () => {
  const entityLayers = (dxf: string) => {
    const l = dxf.split('\n');
    const set = new Set<string>();
    for (let i = 0; i < l.length - 1; i++) if (l[i] === '8') set.add(l[i + 1]);
    return set;
  };
  const textValues = (dxf: string) => {
    const l = dxf.split('\n');
    const out: string[] = [];
    for (let i = 0; i < l.length - 1; i++) if (l[i] === '1') out.push(l[i + 1]);
    return out;
  };

  it('cartouche présent par défaut, absent avec titleBlock:false', () => {
    const p = { ...project(false), client: 'Société Étoile', location: 'Yaoundé', planNumber: 'PL-042', checkedBy: 'M. Kamga', revision: 'B' };
    const m = computeSurveyMetrics(p.points);
    const on = generateDxfContent(p, m, { date: new Date(2026, 9, 19) });
    expect(entityLayers(on)).toContain('CADRE');
    expect(entityLayers(on)).toContain('CARTOUCHE');
    expect(entityLayers(on)).toContain('TABLEAU_COORDONNEES');
    const texts = textValues(on);
    expect(texts).toContain('Parcelle des Chenes');
    expect(dxfAscii('Lot 4 — n° 12 « l’Étoile » × 2 …')).toBe('Lot 4 - no 12 " l\'Etoile " x 2 ...');
    expect(texts).toContain('Societe Etoile');
    expect(texts).toContain('PL-042');
    expect(texts).toContain('19/10/2026');
    expect(texts).toContain('1:500'); // 40 m × 30 m : format A4, échelle normalisée 1:500 (zone de dessin utile de 239 × 100 mm)
    expect(/^[\x20-\x7E\n]*$/.test(on)).toBe(true);
    const off = generateDxfContent(p, m, { titleBlock: false });
    expect(entityLayers(off)).not.toContain('CADRE');
    expect(vertices(off)).toEqual(vertices(on));
  });

  it('tous les textes utilisent le style Arial Narrow (arialn.ttf)', () => {
    const p = project(false);
    const dxf = generateDxfContent(p, computeSurveyMetrics(p.points));
    const l = dxf.split('\n');
    expect(l).toContain('ARIAL_NARROW');
    expect(l[l.indexOf('arialn.ttf') - 1]).toBe('3');
    expect(l).toContain('Arial Narrow');
    // chaque TEXT porte le style
    let texts = 0;
    for (let i = 0; i < l.length; i++) {
      if (l[i] === 'TEXT' && l[i - 1] === '0') {
        texts++;
        expect(l[i + 1]).toBe('7');
        expect(l[i + 2]).toBe('ARIAL_NARROW');
      }
    }
    expect(texts).toBeGreaterThan(30);
    const legacy = generateDxfContent(p, computeSurveyMetrics(p.points), { titleBlock: false }).split('\n');
    expect(legacy).toContain('ARIAL_NARROW');
  });

  it('nombre de calques déclaré = calques définis', () => {
    const p = project(false);
    const dxf = generateDxfContent(p, computeSurveyMetrics(p.points));
    const l = dxf.split('\n');
    const i = l.indexOf('LAYER');
    const declared = Number(l[l.indexOf('70', i) + 1]);
    const defined = l.filter((v, j) => v === 'LAYER' && l[j - 1] === '0').length;
    expect(defined).toBe(declared);
  });

  it('choix automatique : plus petit format avec une échelle normalisée ≤ 1:500', () => {
    const small = chooseLayout({ minX: 0, maxX: 40, minY: 0, maxY: 30 });
    expect(small.format.name).toBe('A4');
    expect(small.scaleDen).toBe(500);
    const big = chooseLayout({ minX: 0, maxX: 400, minY: 0, maxY: 300 });
    expect(big.scaleDen).toBeLessThanOrEqual(1000);
    expect(['A3', 'A2', 'A1', 'A0']).toContain(big.format.name);
    const forced = chooseLayout({ minX: 0, maxX: 40, minY: 0, maxY: 30 }, { format: 'A3', scale: 100 });
    expect(forced.format.name).toBe('A3');
    expect(forced.scaleDen).toBe(100);
  });

  it('la feuille est à l’échelle : cadre A4 à 1:200 = 267 mm × 190 mm papier (marge de classement 20 mm, bordure 10 mm)', () => {
    const lay = chooseLayout({ minX: 0, maxX: 40, minY: 0, maxY: 30 }, { format: 'A4', scale: 200 });
    expect(lay.k).toBeCloseTo(0.2, 6);
    expect((lay.frame.x1 - lay.frame.x0) * lay.k).toBeCloseTo(267 * 0.2, 6);
    expect((lay.frame.y1 - lay.frame.y0) * lay.k).toBeCloseTo(190 * 0.2, 6);
    // le dessin est centré dans la zone au-dessus du cartouche
    const cxModel = lay.origin.x + ((lay.zone.x0 + lay.zone.x1) / 2) * lay.k;
    const cyModel = lay.origin.y + ((lay.zone.y0 + lay.zone.y1) / 2) * lay.k;
    expect(cxModel).toBeCloseTo(20, 6);
    expect(cyModel).toBeCloseTo(15, 6);
  });

  it('UTM : la feuille suit les coordonnées UTM, sommets inchangés', () => {
    const p = project(true);
    const m = computeSurveyMetrics(p.points);
    const dxf = generateDxfContent(p, m, { coordinates: 'utm' });
    expect(textValues(dxf).some((t) => t.includes('EPSG:32632'))).toBe(true);
    expect(textValues(dxf)).toContain('E (m)');
    expect(vertices(dxf)).toEqual(vertices(generateDxfContent(p, m, { coordinates: 'utm', titleBlock: false })));
  });

  it('beaucoup de bornes : le tableau signale les bornes non listées', () => {
    const coords = Array.from({ length: 40 }, (_, i) => [Math.cos((i / 40) * 2 * Math.PI) * 50, Math.sin((i / 40) * 2 * Math.PI) * 50]);
    const p = project(false, coords);
    const dxf = generateDxfContent(p, computeSurveyMetrics(p.points), { sheet: { format: 'A4', scale: 'auto' } });
    expect(textValues(dxf).some((t) => t.includes('voir export CSV'))).toBe(true);
  });
});
