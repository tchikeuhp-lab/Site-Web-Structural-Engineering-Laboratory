import { describe, expect, it } from 'vitest';
import { fromUtm, toUtm, utmZoneFromLon } from '../utm';

describe('UTM WGS84', () => {
  it('fuseaux du Cameroun', () => {
    expect(utmZoneFromLon(11.5021)).toBe(32); // Yaoundé
    expect(utmZoneFromLon(9.7)).toBe(32); // Douala
    expect(utmZoneFromLon(13.58)).toBe(33); // Ngaoundéré
  });

  it('méridien central : E = 500 000 m, équateur : N = 0', () => {
    const u = toUtm(0, 9);
    expect(u.easting).toBeCloseTo(500000, 3);
    expect(u.northing).toBeCloseTo(0, 3);
  });

  it('1° de latitude sur le méridien central ≈ k0 × 110 574,3 m', () => {
    const u = toUtm(1, 9);
    expect(u.northing).toBeGreaterThan(110520);
    expect(u.northing).toBeLessThan(110540);
  });

  it('valeur de référence connue (Tour Eiffel, 31U) à ~1 m', () => {
    const u = toUtm(48.8584, 2.2945);
    expect(u.zone).toBe(31);
    expect(u.easting).toBeGreaterThan(448200);
    expect(u.easting).toBeLessThan(448300);
    expect(u.northing).toBeGreaterThan(5411900);
    expect(u.northing).toBeLessThan(5412000);
  });

  it('hémisphère sud : faux nord 10 000 000 m', () => {
    const u = toUtm(-1, 9);
    expect(u.hemisphere).toBe('S');
    expect(u.northing).toBeCloseTo(10000000 - 110530.2, -1);
    expect(u.epsg).toBe(32732);
  });

  it.each([
    [3.848, 11.5021],
    [4.0511, 9.7679],
    [10.5, 14.3],
    [-33.9, 18.4],
    [51.5, -0.12],
  ])('aller-retour (%s, %s) < 1 mm', (lat, lon) => {
    const back = fromUtm(toUtm(lat, lon));
    expect(Math.abs(back.lat - lat) * 111000).toBeLessThan(0.001);
    expect(Math.abs(back.lon - lon) * 111000 * Math.cos((lat * Math.PI) / 180)).toBeLessThan(0.001);
  });
});
