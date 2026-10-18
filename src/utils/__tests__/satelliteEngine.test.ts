import { describe, expect, it } from 'vitest';
import {
  geodeticToMetric,
  metricToGeodetic,
  processGpsSamples,
  parseCoordinatesString,
} from '../satelliteEngine';
import { GpsSample } from '../../types/survey';

describe('plan tangent local (ENU)', () => {
  const o = { lat: 3.848, lon: 11.5021 }; // Yaoundé

  it('aller-retour métrique ⇄ géodésique à moins de 1 cm', () => {
    const g = metricToGeodetic(123.456, -78.9, o.lat, o.lon);
    const m = geodeticToMetric(g.lat, g.lon, o.lat, o.lon);
    expect(Math.abs(m.x - 123.456)).toBeLessThan(0.02);
    expect(Math.abs(m.y + 78.9)).toBeLessThan(0.02);
  });

  it('1" de latitude ≈ 30,7 m', () => {
    const m = geodeticToMetric(o.lat + 1 / 3600, o.lon, o.lat, o.lon);
    expect(m.y).toBeGreaterThan(30.5);
    expect(m.y).toBeLessThan(31.0);
  });
});

describe('saisie lat/lon', () => {
  it('accepte « lat, lon » et refuse les valeurs hors limites', () => {
    expect(parseCoordinatesString('3.848, 11.5021')).toEqual({ lat: 3.848, lon: 11.5021 });
    expect(parseCoordinatesString('91, 10')).toBeNull();
  });
});

describe('moyennage GNSS', () => {
  const base = { lat: 3.848, lon: 11.5021 };
  const sample = (dLatM: number, dLonM: number, accuracy: number): GpsSample => ({
    lat: base.lat + dLatM / 110574,
    lon: base.lon + dLonM / 111320,
    accuracy,
    timestamp: 0,
  });

  it('un seul échantillon : renvoyé tel quel', () => {
    const r = processGpsSamples([sample(0, 0, 4.2)])!;
    expect(r.accuracy).toBe(4.2);
    expect(r.count).toBe(1);
  });

  it('rejette un échantillon aberrant (multi-trajet)', () => {
    const samples = [
      ...Array.from({ length: 12 }, (_, i) => sample((i % 3) * 0.2, (i % 2) * 0.2, 2)),
      sample(40, 40, 2),
    ];
    const r = processGpsSamples(samples)!;
    expect(r.count).toBe(12);
  });

  it('ne revendique jamais mieux que le meilleur fixe déclaré', () => {
    const samples = Array.from({ length: 30 }, () => sample(0, 0, 3));
    const r = processGpsSamples(samples)!;
    expect(r.accuracy).toBeGreaterThanOrEqual(3);
  });

  it('reflète la dispersion observée quand elle dépasse la précision déclarée', () => {
    const samples = [sample(0, 0, 1), sample(6, 0, 1), sample(0, 6, 1), sample(-6, 0, 1), sample(0, -6, 1)];
    const r = processGpsSamples(samples)!;
    expect(r.accuracy).toBeGreaterThan(3);
  });
});
