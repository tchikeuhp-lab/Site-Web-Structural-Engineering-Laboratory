import { describe, expect, it } from 'vitest';
import { DxfUtmUnavailableError, generateDxfContent } from '../dxfExporter';
import { generateGeoJsonContent, NotGeoreferencedError } from '../geojsonExporter';
import { generateKmlContent } from '../kmlExporter';
import { generateCsvContent, csvCell } from '../csvExporter';
import { computeSurveyMetrics } from '../geometryEngine';
import { metricToGeodetic } from '../satelliteEngine';
import { safeFileName } from '../download';
import { toUtm } from '../utm';
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
    if (l[i] === 'VERTEX') {
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
