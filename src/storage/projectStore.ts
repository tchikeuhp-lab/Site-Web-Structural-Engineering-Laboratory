import { createStore, del, get, getMany, keys, set } from 'idb-keyval';
import { AreaUnit, AuditProject, CoordinateDisplayMode, Point2D, PointSource } from '../types/survey';
import { newId } from '../utils/projectGeo';

export const SCHEMA_VERSION = 2;
const LEGACY_LS_KEY = 'arpentis_survey_project_v1';
const PROJECT_PREFIX = 'project:';
const ACTIVE_KEY = 'activeId';
const MIGRATED_KEY = 'migrated-from-localstorage-v1';

const VALID_UNITS: AreaUnit[] = ['m2', 'ha_a_ca', 'ha', 'a', 'ca', 'km2', 'sqft', 'acres'];
const VALID_MODES: CoordinateDisplayMode[] = ['metric', 'gps_dd', 'gps_dms'];
const VALID_SOURCES: PointSource[] = ['gnss', 'manual', 'local', 'shape', 'example', 'simulated'];

// ---------------------------------------------------------------------------
// Validation / migration (fonctions pures, testées)
// ---------------------------------------------------------------------------

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const str = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v : fallback);

function sanitizePoint(raw: unknown, index: number): Point2D | null {
  if (!isObj(raw) || !isNum(raw.x) || !isNum(raw.y)) return null;

  const p: Point2D = {
    id: typeof raw.id === 'string' && raw.id ? raw.id : newId('p'),
    name: typeof raw.name === 'string' && raw.name.trim() ? raw.name : `P${index + 1}`,
    x: raw.x,
    y: raw.y,
  };
  if (isNum(raw.lat) && isNum(raw.lon) && Math.abs(raw.lat) <= 90 && Math.abs(raw.lon) <= 180) {
    p.lat = raw.lat;
    p.lon = raw.lon;
  }
  if (isNum(raw.altitude)) p.altitude = raw.altitude;
  if (isNum(raw.gpsAccuracy) && raw.gpsAccuracy > 0) p.gpsAccuracy = raw.gpsAccuracy;
  if (isNum(raw.fixCount) && raw.fixCount > 0) p.fixCount = Math.round(raw.fixCount);
  if (isNum(raw.timestamp)) p.timestamp = raw.timestamp;
  if (typeof raw.source === 'string' && (VALID_SOURCES as string[]).includes(raw.source)) {
    p.source = raw.source as PointSource;
  }
  return p;
}

/** Valide et normalise un projet quelconque (stockage, import, ancienne version). Retourne null si inexploitable. */
export function sanitizeProject(raw: unknown): AuditProject | null {
  if (!isObj(raw) || !Array.isArray(raw.points)) return null;

  const seen = new Set<string>();
  const points: Point2D[] = [];
  raw.points.forEach((rp, i) => {
    const p = sanitizePoint(rp, i);
    if (!p) return;
    if (seen.has(p.id)) p.id = newId('p'); // identifiants uniques garantis
    seen.add(p.id);
    points.push(p);
  });

  const now = new Date().toISOString();
  const project: AuditProject = {
    id: typeof raw.id === 'string' && raw.id ? raw.id : newId('proj'),
    schemaVersion: SCHEMA_VERSION,
    title: str(raw.title, 'Relevé sans titre') || 'Relevé sans titre',
    referenceCadastrale: str(raw.referenceCadastrale),
    operatorName: str(raw.operatorName),
    notes: str(raw.notes),
    createdAt: str(raw.createdAt, now),
    updatedAt: str(raw.updatedAt, now),
    points,
    unit: (VALID_UNITS as string[]).includes(raw.unit as string) ? (raw.unit as AreaUnit) : 'm2',
    coordinateMode: (VALID_MODES as string[]).includes(raw.coordinateMode as string)
      ? (raw.coordinateMode as CoordinateDisplayMode)
      : 'metric',
  };

  const o = raw.originGeodetic;
  if (isObj(o) && isNum(o.lat) && isNum(o.lon) && Math.abs(o.lat) <= 90 && Math.abs(o.lon) <= 180) {
    project.originGeodetic = { lat: o.lat, lon: o.lon };
  }
  return project;
}

/**
 * Migration depuis la v1 (localStorage) : le projet d'exemple d'origine était ancré à Paris.
 * Un tel projet non modifié est converti en exemple local (sans géoréférencement fictif).
 */
export function migrateLegacyProject(raw: unknown): AuditProject | null {
  const project = sanitizeProject(raw);
  if (!project) return null;

  const isUntouchedSample =
    isObj(raw) &&
    raw.id === 'proj-default-1' &&
    project.points.length === 5 &&
    project.points.every((p) => /^Borne [A-E]$/.test(p.name));

  if (isUntouchedSample) {
    delete project.originGeodetic;
    project.points = project.points.map(({ lat: _lat, lon: _lon, ...rest }) => ({ ...rest, source: 'example' as const }));
    project.id = newId('proj');
  }
  return project;
}

export function createEmptyProject(partial: Partial<AuditProject> = {}): AuditProject {
  const now = new Date().toISOString();
  return {
    id: newId('proj'),
    schemaVersion: SCHEMA_VERSION,
    title: 'Nouveau relevé',
    referenceCadastrale: '',
    operatorName: '',
    notes: '',
    createdAt: now,
    updatedAt: now,
    unit: 'm2',
    coordinateMode: 'metric',
    points: [],
    ...partial,
  };
}

/** Parcelle de démonstration en coordonnées locales (aucun géoréférencement fictif). */
export function createExampleProject(): AuditProject {
  return createEmptyProject({
    title: 'Exemple — Parcelle de 5 bornes',
    referenceCadastrale: 'Exemple',
    notes: 'Parcelle de démonstration en coordonnées locales (non géoréférencée). Supprimez-la librement.',
    points: [
      { id: newId('p'), name: 'Borne A', x: -15, y: -15, source: 'example' },
      { id: newId('p'), name: 'Borne B', x: 25, y: -18, source: 'example' },
      { id: newId('p'), name: 'Borne C', x: 30, y: 15, source: 'example' },
      { id: newId('p'), name: 'Borne D', x: 5, y: 22, source: 'example' },
      { id: newId('p'), name: 'Borne E', x: -18, y: 12, source: 'example' },
    ],
  });
}

// ---------------------------------------------------------------------------
// Import / export JSON
// ---------------------------------------------------------------------------

const PROJECT_FORMAT = 'arpentis-project';
const BACKUP_FORMAT = 'arpentis-backup';

export function serializeProject(project: AuditProject): string {
  return JSON.stringify(
    { format: PROJECT_FORMAT, schemaVersion: SCHEMA_VERSION, exportedAt: new Date().toISOString(), project },
    null,
    2
  );
}

export function serializeBackup(projects: AuditProject[]): string {
  return JSON.stringify(
    { format: BACKUP_FORMAT, schemaVersion: SCHEMA_VERSION, exportedAt: new Date().toISOString(), projects },
    null,
    2
  );
}

/** Lit un fichier JSON Arpentis (projet seul, sauvegarde complète ou projet brut) et retourne des projets valides. */
export function parseImport(text: string): { projects: AuditProject[]; skipped: number } {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('Fichier illisible : ce n’est pas un JSON valide.');
  }

  let rawList: unknown[] = [];
  if (isObj(data) && data.format === BACKUP_FORMAT && Array.isArray(data.projects)) rawList = data.projects;
  else if (isObj(data) && data.format === PROJECT_FORMAT && data.project) rawList = [data.project];
  else if (isObj(data) && Array.isArray(data.points)) rawList = [data];
  else throw new Error('Format non reconnu : ce fichier n’a pas été exporté par Arpentis.');

  const projects = rawList.map(sanitizeProject).filter((p): p is AuditProject => p !== null);
  return { projects, skipped: rawList.length - projects.length };
}

// ---------------------------------------------------------------------------
// Stockage IndexedDB
// ---------------------------------------------------------------------------

let _store: ReturnType<typeof createStore> | null = null;
const store = () => (_store ??= createStore('arpentis', 'kv'));

export interface Workspace {
  projects: AuditProject[];
  activeId: string;
  /** false si IndexedDB est inutilisable (navigation privée stricte, stockage bloqué) */
  storageAvailable: boolean;
  migratedFromLegacy: boolean;
}

export async function loadWorkspace(): Promise<Workspace> {
  try {
    const allKeys = (await keys(store())).filter(
      (k): k is string => typeof k === 'string' && k.startsWith(PROJECT_PREFIX)
    );
    let projects: AuditProject[] = [];
    let migratedFromLegacy = false;

    if (allKeys.length > 0) {
      const raws = await getMany(allKeys, store());
      projects = raws.map(sanitizeProject).filter((p): p is AuditProject => p !== null);
    } else if (!(await get(MIGRATED_KEY, store()))) {
      // Première ouverture de la v2 : récupération éventuelle de l'ancien projet (localStorage)
      try {
        const legacy = localStorage.getItem(LEGACY_LS_KEY);
        if (legacy) {
          const migrated = migrateLegacyProject(JSON.parse(legacy));
          if (migrated) {
            projects = [migrated];
            migratedFromLegacy = true;
            await set(PROJECT_PREFIX + migrated.id, migrated, store());
          }
        }
      } catch {
        /* localStorage illisible : on repart d'un espace vide */
      }
      await set(MIGRATED_KEY, true, store());
    }

    if (projects.length === 0) {
      const fresh = createEmptyProject();
      projects = [fresh];
      await set(PROJECT_PREFIX + fresh.id, fresh, store());
    }

    projects.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    const savedActive = await get<string>(ACTIVE_KEY, store());
    const activeId = projects.some((p) => p.id === savedActive) ? (savedActive as string) : projects[0].id;

    return { projects, activeId, storageAvailable: true, migratedFromLegacy };
  } catch {
    const fresh = createEmptyProject();
    return { projects: [fresh], activeId: fresh.id, storageAvailable: false, migratedFromLegacy: false };
  }
}

export async function saveProject(project: AuditProject): Promise<void> {
  await set(PROJECT_PREFIX + project.id, { ...project, schemaVersion: SCHEMA_VERSION }, store());
}

export async function deleteProjectById(id: string): Promise<void> {
  await del(PROJECT_PREFIX + id, store());
}

export async function saveActiveId(id: string): Promise<void> {
  await set(ACTIVE_KEY, id, store());
}

/** Demande au navigateur de ne pas purger les données locales en cas de manque d'espace. */
export async function requestPersistence(): Promise<boolean> {
  try {
    if (navigator.storage?.persist) {
      if (await navigator.storage.persisted()) return true;
      return await navigator.storage.persist();
    }
  } catch {
    /* non supporté */
  }
  return false;
}
