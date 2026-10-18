import { describe, expect, it } from 'vitest';
import {
  SCHEMA_VERSION,
  createExampleProject,
  migrateLegacyProject,
  parseImport,
  sanitizeProject,
  serializeBackup,
  serializeProject,
} from '../projectStore';

describe('sanitizeProject', () => {
  it('rejette ce qui n’est pas un projet', () => {
    expect(sanitizeProject(null)).toBeNull();
    expect(sanitizeProject('x')).toBeNull();
    expect(sanitizeProject({ points: 'non' })).toBeNull();
  });

  it('écarte les bornes invalides (NaN, texte) et corrige les valeurs', () => {
    const p = sanitizeProject({
      id: 'a',
      title: 12,
      unit: 'banane',
      points: [
        { id: '1', name: 'A', x: 1, y: 2 },
        { id: '2', name: 'B', x: 'oups', y: 2 },
        { id: '3', name: 'C', x: Number.NaN, y: 0 },
        { id: '4', name: '', x: 5, y: 6, lat: 200, lon: 0, source: 'inconnue' },
      ],
    })!;
    expect(p.points).toHaveLength(2);
    expect(p.points[1].name).toBe('P4');
    expect(p.points[1].lat).toBeUndefined();
    expect(p.points[1].source).toBeUndefined();
    expect(p.unit).toBe('m2');
    expect(p.title).toBe('Relevé sans titre');
    expect(p.schemaVersion).toBe(SCHEMA_VERSION);
  });

  it('garantit des identifiants de bornes uniques', () => {
    const p = sanitizeProject({
      points: [
        { id: 'x', name: 'A', x: 0, y: 0 },
        { id: 'x', name: 'B', x: 1, y: 1 },
      ],
    })!;
    expect(new Set(p.points.map((q) => q.id)).size).toBe(2);
  });

  it('ignore une origine invalide', () => {
    expect(sanitizeProject({ points: [], originGeodetic: { lat: 99, lon: 0 } })!.originGeodetic).toBeUndefined();
    expect(sanitizeProject({ points: [], originGeodetic: { lat: 3.8, lon: 11.5 } })!.originGeodetic).toEqual({ lat: 3.8, lon: 11.5 });
  });
});

describe('migration v1 → v2', () => {
  const legacySample = {
    id: 'proj-default-1',
    title: 'Parcelle des Chênes (Lot 4)',
    originGeodetic: { lat: 48.856614, lon: 2.352222 },
    points: ['A', 'B', 'C', 'D', 'E'].map((l, i) => ({
      id: `p-${i + 1}`, name: `Borne ${l}`, x: i, y: i * 2, lat: 48.85 + i / 1e4, lon: 2.35,
    })),
  };

  it('convertit le projet d’exemple parisien en exemple local non géoréférencé', () => {
    const m = migrateLegacyProject(legacySample)!;
    expect(m.originGeodetic).toBeUndefined();
    expect(m.points.every((p) => p.lat === undefined && p.source === 'example')).toBe(true);
  });

  it('conserve intact un vrai relevé de l’utilisateur', () => {
    const real = { ...legacySample, id: 'proj-1700000', originGeodetic: { lat: 3.848, lon: 11.5021 } };
    const m = migrateLegacyProject(real)!;
    expect(m.originGeodetic).toEqual({ lat: 3.848, lon: 11.5021 });
    expect(m.points[0].lat).toBeDefined();
  });
});

describe('import / export JSON', () => {
  it('aller-retour d’un projet', () => {
    const original = createExampleProject();
    const { projects, skipped } = parseImport(serializeProject(original));
    expect(skipped).toBe(0);
    expect(projects).toHaveLength(1);
    expect(projects[0].points).toEqual(original.points);
    expect(projects[0].title).toBe(original.title);
  });

  it('aller-retour d’une sauvegarde complète', () => {
    const { projects } = parseImport(serializeBackup([createExampleProject(), createExampleProject()]));
    expect(projects).toHaveLength(2);
  });

  it('accepte un projet brut et refuse le reste', () => {
    expect(parseImport(JSON.stringify({ points: [{ id: 'a', name: 'A', x: 0, y: 0 }] })).projects).toHaveLength(1);
    expect(() => parseImport('pas du json')).toThrow(/JSON/);
    expect(() => parseImport('{"foo":1}')).toThrow(/Format non reconnu/);
  });
});
