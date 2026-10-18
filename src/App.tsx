import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AuditProject, Point2D, AreaUnit, PointSource } from './types/survey';
import { computeSurveyMetrics } from './utils/geometryEngine';
import { geodeticToMetric, metricToGeodetic, calculateChamberlainDuquetteArea } from './utils/satelliteEngine';
import {
  MAX_RADIUS_FROM_ORIGIN_M,
  getPointGeodetic,
  newId,
  withGeodetic,
  withMetric,
} from './utils/projectGeo';
import { safeFileName, triggerDownload } from './utils/download';
import { useDeviceGps } from './hooks/useDeviceGps';
import { useProjectHistory } from './state/useProjectHistory';
import {
  Workspace,
  createEmptyProject,
  createExampleProject,
  deleteProjectById,
  loadWorkspace,
  parseImport,
  requestPersistence,
  saveActiveId,
  saveProject,
  serializeBackup,
  serializeProject,
} from './storage/projectStore';
import { MobileTopBar } from './components/MobileTopBar';
import { MobileSurveyCanvas } from './components/MobileSurveyCanvas';
import { MetricSummaryBar } from './components/MetricSummaryBar';
import { MobileBottomNav, NavTab } from './components/MobileBottomNav';
import { ShapesDrawer } from './components/drawers/ShapesDrawer';
import { PointsListDrawer, PointEditMode } from './components/drawers/PointsListDrawer';
import { ExportDrawer } from './components/drawers/ExportDrawer';
import { ProjectsDrawer } from './components/drawers/ProjectsDrawer';
import { AuditReportModal } from './components/AuditReportModal';
import { TrianglesDetailsModal } from './components/TrianglesDetailsModal';
import { GpsAveragingModal } from './components/GpsAveragingModal';
import { Toast, ToastMessage } from './components/Toast';
import { PwaStatus } from './components/PwaStatus';
import { useConfirm } from './components/ConfirmDialog';
import { AlertTriangle } from 'lucide-react';

const nowIso = () => new Date().toISOString();

interface GeoPointInput {
  lat: number;
  lon: number;
  altitude?: number;
  accuracy?: number;
  fixCount?: number;
  name?: string;
  source: Extract<PointSource, 'gnss' | 'manual' | 'simulated'>;
}

/** Point d'entrée : charge l'espace de travail (IndexedDB) avant d'afficher l'application. */
export default function App() {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);

  useEffect(() => {
    let alive = true;
    loadWorkspace().then((ws) => alive && setWorkspace(ws));
    void requestPersistence();
    return () => {
      alive = false;
    };
  }, []);

  if (!workspace) {
    return (
      <div className="flex h-dvh w-full items-center justify-center bg-slate-950 text-slate-400">
        <span className="animate-pulse text-sm">Chargement de vos relevés…</span>
      </div>
    );
  }
  return <SurveyApp initial={workspace} />;
}

function SurveyApp({ initial }: { initial: Workspace }) {
  const confirm = useConfirm();
  const activeInitial = initial.projects.find((p) => p.id === initial.activeId) ?? initial.projects[0];
  const { project, commit, undo, redo, reset, canUndo, canRedo } = useProjectHistory(activeInitial);
  const [others, setOthers] = useState<AuditProject[]>(() =>
    initial.projects.filter((p) => p.id !== activeInitial.id)
  );
  const [storageOk] = useState(initial.storageAvailable);
  const [saveError, setSaveError] = useState(false);

  // ------------------------------------------------------------------ notifications
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const notify = useCallback((kind: ToastMessage['kind'], message: string, action?: ToastMessage['action']) => {
    setToast({ id: Date.now(), kind, message, action });
  }, []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), toast.action || toast.kind === 'error' ? 7000 : 4000);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    if (initial.migratedFromLegacy) {
      notify('info', 'Votre relevé précédent a été repris dans la nouvelle version d’Arpentis.');
    }
  }, [initial.migratedFromLegacy, notify]);

  // ------------------------------------------------------------------ persistance (IndexedDB)
  const latest = useRef(project);
  latest.current = project;

  useEffect(() => {
    if (!storageOk) return;
    const timer = setTimeout(() => {
      saveProject(project)
        .then(() => setSaveError(false))
        .catch(() => setSaveError(true));
    }, 400);
    return () => clearTimeout(timer);
  }, [project, storageOk]);

  useEffect(() => {
    if (!storageOk) return;
    const flush = () => void saveProject(latest.current).catch(() => undefined);
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', flush);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', flush);
    };
  }, [storageOk]);

  // ------------------------------------------------------------------ GNSS continu (économie de batterie en arrière-plan)
  const { currentFix, permissionState, startTracking, stopTracking } = useDeviceGps();

  useEffect(() => {
    if (permissionState === 'granted') startTracking();
  }, [permissionState, startTracking]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') stopTracking();
      else if (permissionState === 'granted') startTracking();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [permissionState, startTracking, stopTracking]);

  // ------------------------------------------------------------------ navigation et modales
  const [activeTab, setActiveTab] = useState<NavTab>('canvas');
  const [focusPointForm, setFocusPointForm] = useState(false);
  const [isProjectsOpen, setIsProjectsOpen] = useState(false);
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
  const [isTrianglesModalOpen, setIsTrianglesModalOpen] = useState(false);
  const [isGpsModalOpen, setIsGpsModalOpen] = useState(false);

  // Raccourcis clavier : annuler / rétablir (hors champs de saisie)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
      if (!(e.ctrlKey || e.metaKey)) return;
      const k = e.key.toLowerCase();
      if (k === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((k === 'z' && e.shiftKey) || k === 'y') {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo]);

  // ------------------------------------------------------------------ calculs
  const origin = project.originGeodetic;

  const metrics = useMemo(() => {
    const res = computeSurveyMetrics(project.points);
    if (origin) {
      const geo = project.points
        .map((p) => getPointGeodetic(p, origin))
        .filter((g): g is { lat: number; lon: number } => g !== null);
      if (geo.length >= 3) res.geodeticAreaM2 = calculateChamberlainDuquetteArea(geo);
      if (project.points.length > 0) {
        res.centroidGeodetic = metricToGeodetic(res.centroid.x, res.centroid.y, origin.lat, origin.lon);
      }
    }
    return res;
  }, [project.points, origin]);

  // Position GPS de l'utilisateur dans le repère local — uniquement si le relevé est géoréférencé
  const currentGpsCanvasPos = useMemo(() => {
    if (!currentFix || !origin) return null;
    const metric = geodeticToMetric(currentFix.lat, currentFix.lon, origin.lat, origin.lon);
    if (Math.hypot(metric.x, metric.y) > MAX_RADIUS_FROM_ORIGIN_M) return null;
    return { x: metric.x, y: metric.y, accuracy: currentFix.accuracy, lat: currentFix.lat, lon: currentFix.lon };
  }, [currentFix, origin]);

  // ------------------------------------------------------------------ édition des bornes
  const handleAddPoint = (newPoint: Point2D) => {
    commit((prev) => ({
      ...prev,
      updatedAt: nowIso(),
      points: [...prev.points, withGeodetic(newPoint, prev.originGeodetic)],
    }));
  };

  /** Ajout d'une borne par coordonnées géographiques. Retourne un message d'erreur, ou null en cas de succès. */
  const handleAddGeoPoint = (g: GeoPointInput): string | null => {
    if (!Number.isFinite(g.lat) || !Number.isFinite(g.lon) || Math.abs(g.lat) > 90 || Math.abs(g.lon) > 180) {
      return 'Coordonnées géographiques invalides.';
    }
    if (project.points.length > 0 && !project.originGeodetic) {
      return 'Ce relevé est en coordonnées locales (non géoréférencé) : créez un nouveau relevé pour utiliser le GPS ou la latitude/longitude.';
    }

    // Première borne : elle devient l'origine du repère local ; ensuite on reste dans le même plan tangent
    const newOrigin = project.points.length === 0 ? { lat: g.lat, lon: g.lon } : project.originGeodetic!;
    const metric = geodeticToMetric(g.lat, g.lon, newOrigin.lat, newOrigin.lon);
    if (Math.hypot(metric.x, metric.y) > MAX_RADIUS_FROM_ORIGIN_M) {
      return `Cette position est à plus de ${MAX_RADIUS_FROM_ORIGIN_M / 1000} km des autres bornes : vérifiez les coordonnées saisies.`;
    }

    const point: Point2D = {
      id: newId('p'),
      name: g.name?.trim() || `Borne ${project.points.length + 1}`,
      x: metric.x,
      y: metric.y,
      lat: g.lat,
      lon: g.lon,
      timestamp: Date.now(),
      source: g.source,
    };
    if (g.altitude !== undefined && Number.isFinite(g.altitude) && g.altitude !== 0) point.altitude = g.altitude;
    if (g.accuracy !== undefined) point.gpsAccuracy = g.accuracy;
    if (g.fixCount !== undefined) point.fixCount = g.fixCount;

    commit((prev) => ({
      ...prev,
      originGeodetic: newOrigin,
      updatedAt: nowIso(),
      points: [...prev.points, point],
    }));
    return null;
  };

  const handleUpdatePoint = (updated: Point2D, mode: PointEditMode = 'meta') => {
    commit(
      (prev) => {
        const old = prev.points.find((p) => p.id === updated.id);
        if (!old) return prev;
        const org = prev.originGeodetic;

        let next = updated;
        if (mode === 'xy') next = withGeodetic(updated, org);
        else if (mode === 'geo' && org) next = withMetric(updated, org);

        // Une coordonnée modifiée à la main n'est plus une mesure GNSS : on ne garde pas sa précision
        if (mode !== 'meta' && (old.source === 'gnss' || old.source === 'simulated')) {
          const { gpsAccuracy: _a, fixCount: _f, ...rest } = next;
          next = { ...rest, source: 'manual' };
        }
        return { ...prev, updatedAt: nowIso(), points: prev.points.map((p) => (p.id === next.id ? next : p)) };
      },
      `pt:${updated.id}:${mode}`
    );
  };

  const handleDeletePoint = (pointId: string) => {
    const target = project.points.find((p) => p.id === pointId);
    commit((prev) => ({
      ...prev,
      updatedAt: nowIso(),
      points: prev.points.filter((p) => p.id !== pointId),
    }));
    if (target) notify('info', `Borne « ${target.name} » supprimée.`, { label: 'Annuler', onClick: undo });
  };

  const handleInvertPoints = () => {
    commit((prev) => ({ ...prev, updatedAt: nowIso(), points: [...prev.points].reverse() }));
  };

  const handleClearPoints = () => {
    commit((prev) => ({ ...prev, updatedAt: nowIso(), points: [] }));
    notify('info', 'Toutes les bornes ont été supprimées.', { label: 'Annuler', onClick: undo });
  };

  const handleApplyShape = async (shapePoints: Point2D[]) => {
    if (project.points.length > 0) {
      const ok = await confirm({
        title: 'Remplacer les bornes actuelles ?',
        message: `Les ${project.points.length} bornes de ce relevé seront remplacées par la forme choisie. Vous pourrez annuler.`,
        confirmLabel: 'Remplacer',
        danger: true,
      });
      if (!ok) return;
    }
    commit((prev) => ({
      ...prev,
      updatedAt: nowIso(),
      points: shapePoints.map((p) => withGeodetic({ ...p, id: newId('p') }, prev.originGeodetic)),
    }));
    setActiveTab('canvas');
  };

  const handleUpdateProjectMeta = (updates: Partial<AuditProject>) => {
    commit((prev) => ({ ...prev, ...updates, updatedAt: nowIso() }), `meta:${Object.keys(updates).join(',')}`);
  };

  const handleConfirmGpsPoint = (coords: {
    lat: number;
    lon: number;
    altitude: number;
    accuracy?: number;
    fixCount: number;
    name: string;
    source: 'gnss' | 'manual' | 'simulated';
  }) => {
    const error = handleAddGeoPoint({
      lat: coords.lat,
      lon: coords.lon,
      altitude: coords.altitude,
      accuracy: coords.accuracy,
      fixCount: coords.fixCount,
      name: coords.name,
      source: coords.source,
    });
    if (error) notify('error', error);
    else notify('success', 'Borne enregistrée.');
  };

  // ------------------------------------------------------------------ gestion des relevés
  const allProjects = useMemo(() => [project, ...others], [project, others]);

  const persistNow = (p: AuditProject) => {
    if (storageOk) saveProject(p).catch(() => setSaveError(true));
  };

  const activate = (target: AuditProject, previous: AuditProject) => {
    persistNow(previous);
    persistNow(target);
    setOthers((prev) => [...prev.filter((p) => p.id !== target.id && p.id !== previous.id), previous]);
    reset(target);
    if (storageOk) void saveActiveId(target.id);
    setActiveTab('canvas');
    setIsProjectsOpen(false);
  };

  const handleOpenProject = (id: string) => {
    const target = others.find((p) => p.id === id);
    if (target) activate(target, project);
  };

  const handleNewProject = () => activate(createEmptyProject(), project);
  const handleLoadExample = () => activate(createExampleProject(), project);

  const handleDuplicate = (id: string) => {
    const source = allProjects.find((p) => p.id === id);
    if (!source) return;
    const copy: AuditProject = {
      ...source,
      id: newId('proj'),
      title: `${source.title} (copie)`,
      points: source.points.map((p) => ({ ...p, id: newId('p') })),
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    persistNow(copy);
    setOthers((prev) => [...prev, copy]);
    notify('success', 'Relevé dupliqué.');
  };

  const handleDeleteProject = async (id: string) => {
    const target = allProjects.find((p) => p.id === id);
    if (!target) return;
    const ok = await confirm({
      title: `Supprimer « ${target.title} » ?`,
      message: 'Ce relevé sera définitivement supprimé de cet appareil. Pensez à le sauvegarder (JSON) avant si besoin.',
      confirmLabel: 'Supprimer définitivement',
      danger: true,
    });
    if (!ok) return;
    if (storageOk) await deleteProjectById(id).catch(() => setSaveError(true));

    if (id === project.id) {
      const fallback = [...others].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] ?? createEmptyProject();
      setOthers((prev) => prev.filter((p) => p.id !== fallback.id));
      persistNow(fallback);
      reset(fallback);
      if (storageOk) void saveActiveId(fallback.id);
    } else {
      setOthers((prev) => prev.filter((p) => p.id !== id));
    }
    notify('info', 'Relevé supprimé.');
  };

  const handleImportFile = async (file: File) => {
    try {
      const { projects, skipped } = parseImport(await file.text());
      if (projects.length === 0) {
        notify('error', 'Aucun relevé exploitable dans ce fichier.');
        return;
      }
      const taken = new Set(allProjects.map((p) => p.id));
      const imported = projects.map((p) =>
        taken.has(p.id) ? { ...p, id: newId('proj'), title: `${p.title} (importé)` } : p
      );
      imported.forEach(persistNow);
      setOthers((prev) => [...prev, ...imported]);
      notify(
        'success',
        `${imported.length} relevé${imported.length > 1 ? 's' : ''} importé${imported.length > 1 ? 's' : ''}` +
          (skipped ? ` (${skipped} ignoré${skipped > 1 ? 's' : ''}, invalide${skipped > 1 ? 's' : ''}).` : '.')
      );
    } catch (err) {
      notify('error', err instanceof Error ? err.message : 'Import impossible.');
    }
  };

  const handleExportCurrent = () => {
    triggerDownload(
      new Blob([serializeProject(project)], { type: 'application/json' }),
      `${safeFileName(project.title)}.arpentis.json`
    );
  };

  const handleExportAll = () => {
    triggerDownload(
      new Blob([serializeBackup(allProjects)], { type: 'application/json' }),
      `arpentis-sauvegarde-${new Date().toISOString().slice(0, 10)}.json`
    );
  };

  // ------------------------------------------------------------------ rendu
  return (
    <div className="flex h-dvh w-full flex-col overflow-hidden bg-slate-950 text-slate-100 font-sans">
      <MobileTopBar
        title={project.title}
        onUpdateTitle={(title) => handleUpdateProjectMeta({ title })}
        onOpenProjects={() => setIsProjectsOpen(true)}
        onOpenGpsModal={() => setIsGpsModalOpen(true)}
        gpsAccuracy={currentFix ? currentFix.accuracy : null}
      />

      {(!storageOk || saveError) && (
        <button
          onClick={() => setIsProjectsOpen(true)}
          className="flex w-full shrink-0 items-center gap-2 border-b border-amber-500/40 bg-amber-500/10 px-3.5 py-1.5 text-left text-[11px] text-amber-200"
        >
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          <span>
            {storageOk
              ? 'Sauvegarde locale impossible (espace saturé ou stockage bloqué). Exportez votre relevé en JSON.'
              : 'Stockage local indisponible (navigation privée ?) : vos relevés seront perdus à la fermeture. Exportez-les en JSON.'}
          </span>
        </button>
      )}

      <main className="relative flex min-h-0 flex-1 w-full flex-col overflow-hidden">
        <MobileSurveyCanvas
          points={project.points}
          metrics={metrics}
          originGeodetic={origin}
          onDeletePoint={handleDeletePoint}
          onUndo={undo}
          onRedo={redo}
          canUndo={canUndo}
          canRedo={canRedo}
          onOpenGpsModal={() => setIsGpsModalOpen(true)}
          onOpenManualInput={() => {
            setFocusPointForm(true);
            setActiveTab('points');
          }}
          gpsPosition={currentGpsCanvasPos}
        />

        <MetricSummaryBar
          metrics={metrics}
          pointsCount={project.points.length}
          currentUnit={project.unit}
          onChangeUnit={(unit: AreaUnit) => handleUpdateProjectMeta({ unit })}
          onOpenDetails={() => setIsTrianglesModalOpen(true)}
        />
      </main>

      <div className="shrink-0" style={{ height: 'var(--nav-h)' }} />
      <MobileBottomNav
        activeTab={activeTab}
        onSelectTab={(tab) => {
          setFocusPointForm(false);
          setActiveTab(tab);
        }}
        pointsCount={project.points.length}
      />

      <ShapesDrawer isOpen={activeTab === 'shapes'} onClose={() => setActiveTab('canvas')} onApplyShape={handleApplyShape} />

      <PointsListDrawer
        isOpen={activeTab === 'points'}
        onClose={() => {
          setFocusPointForm(false);
          setActiveTab('canvas');
        }}
        points={project.points}
        metrics={metrics}
        originGeodetic={origin}
        autoFocusForm={focusPointForm}
        onUpdatePoint={handleUpdatePoint}
        onAddPoint={handleAddPoint}
        onAddGeoPoint={handleAddGeoPoint}
        onDeletePoint={handleDeletePoint}
        onInvertPoints={handleInvertPoints}
        onClearPoints={handleClearPoints}
        onOpenGpsModal={() => setIsGpsModalOpen(true)}
      />

      <ExportDrawer
        isOpen={activeTab === 'export'}
        onClose={() => setActiveTab('canvas')}
        project={project}
        metrics={metrics}
        onUpdateProjectMeta={handleUpdateProjectMeta}
        onOpenPdfReport={() => setIsPdfModalOpen(true)}
      />

      <ProjectsDrawer
        isOpen={isProjectsOpen}
        onClose={() => setIsProjectsOpen(false)}
        projects={allProjects}
        activeId={project.id}
        storageAvailable={storageOk}
        onOpenProject={handleOpenProject}
        onNewProject={handleNewProject}
        onLoadExample={handleLoadExample}
        onDuplicate={handleDuplicate}
        onDelete={handleDeleteProject}
        onImportFile={handleImportFile}
        onExportCurrent={handleExportCurrent}
        onExportAll={handleExportAll}
      />

      <AuditReportModal isOpen={isPdfModalOpen} onClose={() => setIsPdfModalOpen(false)} project={project} metrics={metrics} />
      <TrianglesDetailsModal isOpen={isTrianglesModalOpen} onClose={() => setIsTrianglesModalOpen(false)} metrics={metrics} />

      <GpsAveragingModal
        isOpen={isGpsModalOpen}
        onClose={() => setIsGpsModalOpen(false)}
        onConfirmPoint={handleConfirmGpsPoint}
        defaultPointName={`Borne ${project.points.length + 1}`}
      />

      <Toast toast={toast} onDismiss={() => setToast(null)} />
      <PwaStatus />
    </div>
  );
}
