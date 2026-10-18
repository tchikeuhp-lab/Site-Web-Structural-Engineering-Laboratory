import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Point2D, CalculationResult } from '../types/survey';
import { ZoomIn, ZoomOut, Maximize2, Plus, Satellite, Crosshair, MapPin, X, Trash2, Undo2, Redo2 } from 'lucide-react';
import { getPointGeodetic } from '../utils/projectGeo';
import { toUtm, formatUtm } from '../utils/utm';

interface MobileSurveyCanvasProps {
  points: Point2D[];
  metrics: CalculationResult;
  originGeodetic?: { lat: number; lon: number };
  onDeletePoint: (pointId: string) => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onOpenGpsModal: () => void;
  onOpenManualInput?: () => void;
  gpsPosition?: { x: number; y: number; accuracy: number; lat: number; lon: number } | null;
}

export const MobileSurveyCanvas: React.FC<MobileSurveyCanvasProps> = ({
  points,
  metrics,
  originGeodetic,
  onDeletePoint,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onOpenGpsModal,
  onOpenManualInput,
  gpsPosition,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Vue métrique : position du centre de l'écran en mètres et échelle (pixels par mètre)
  const [viewCenter, setViewCenter] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [scale, setScale] = useState<number>(12); // 12 pixels pour 1 mètre par défaut

  // État du menu d'ajout rapide (GNSS ou saisie manuelle)
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);

  // État de sélection d'une borne pour inspection (lecture seule, sans risque de déplacement)
  const [selectedPointId, setSelectedPointId] = useState<string | null>(null);

  // Gestes : pointeurs actifs (1 doigt = pan / tap, 2 doigts = pincement + pan)
  const [isPanning, setIsPanning] = useState(false);
  const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const gestureRef = useRef<{
    startX: number;
    startY: number;
    moved: boolean;
    multi: boolean;
    lastDist: number;
    lastMidX: number;
    lastMidY: number;
  } | null>(null);
  const TAP_SLOP_PX = 8; // en deçà, le geste est un tap ; au-delà, un déplacement de la vue

  // Dimensions du conteneur
  const [dimensions, setDimensions] = useState<{ width: number; height: number }>({
    width: 600,
    height: 600,
  });

  useEffect(() => {
    if (!containerRef.current) return;
    const updateSize = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    };
    updateSize();

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect) {
          setDimensions({
            width: entry.contentRect.width,
            height: entry.contentRect.height,
          });
        }
      }
    });

    resizeObserver.observe(containerRef.current);
    window.addEventListener('resize', updateSize);
    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateSize);
    };
  }, []);

  // Conversion monde (mètres) -> écran (pixels)
  const worldToScreen = useCallback(
    (wx: number, wy: number) => {
      const sx = dimensions.width / 2 + (wx - viewCenter.x) * scale;
      const sy = dimensions.height / 2 - (wy - viewCenter.y) * scale; // Y inversé (vers le haut en coordonnées cartésiennes)
      return { x: sx, y: sy };
    },
    [dimensions, viewCenter, scale]
  );

  // Conversion écran (pixels) -> monde (mètres)
  const screenToWorld = useCallback(
    (sx: number, sy: number) => {
      const wx = viewCenter.x + (sx - dimensions.width / 2) / scale;
      const wy = viewCenter.y - (sy - dimensions.height / 2) / scale;
      return { x: wx, y: wy };
    },
    [dimensions, viewCenter, scale]
  );

  // Ajustement automatique de la vue (Fit to screen)
  const fitToScreen = useCallback(() => {
    if (points.length === 0) {
      setViewCenter({ x: 0, y: 0 });
      setScale(12);
      return;
    }

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    for (const p of points) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }

    const padding = 60; // Pixels de marge
    const spanX = Math.max(10, maxX - minX);
    const spanY = Math.max(10, maxY - minY);

    const availableW = Math.max(100, dimensions.width - padding * 2);
    const availableH = Math.max(100, dimensions.height - padding * 2);

    const fitScale = Math.min(availableW / spanX, availableH / spanY, 40);

    setViewCenter({
      x: (minX + maxX) / 2,
      y: (minY + maxY) / 2,
    });
    setScale(Math.max(2, fitScale));
  }, [points, dimensions]);

  // Cadrage automatique à l'ouverture et à chaque ajout de borne (la nouvelle borne reste visible)
  const previousCount = useRef(0);
  useEffect(() => {
    const grew = points.length > previousCount.current;
    previousCount.current = points.length;
    if (points.length >= 3 || (grew && points.length > 0)) fitToScreen();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points.length]);

  // Zoom en gardant fixe le point du plan situé sous (sx, sy) — curseur ou milieu des deux doigts
  const zoomAt = useCallback(
    (factor: number, sx: number, sy: number) => {
      const next = Math.min(100, Math.max(1, scale * factor));
      const k = next / scale;
      if (k === 1) return;
      const wx = viewCenter.x + (sx - dimensions.width / 2) / scale;
      const wy = viewCenter.y - (sy - dimensions.height / 2) / scale;
      setScale(next);
      setViewCenter({
        x: wx - (sx - dimensions.width / 2) / next,
        y: wy + (sy - dimensions.height / 2) / next,
      });
    },
    [scale, viewCenter, dimensions]
  );

  const localPos = (e: { clientX: number; clientY: number }) => {
    const rect = containerRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const pointAt = (sx: number, sy: number): Point2D | null => {
    const touchThreshold = 28; // rayon de tolérance du doigt, en pixels
    let best: Point2D | null = null;
    let bestDist = touchThreshold;
    for (const p of points) {
      const pos = worldToScreen(p.x, p.y);
      const d = Math.hypot(pos.x - sx, pos.y - sy);
      if (d <= bestDist) {
        best = p;
        bestDist = d;
      }
    }
    return best;
  };

  const pointersCenter = () => {
    const [a, b] = [...pointersRef.current.values()];
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, dist: Math.hypot(a.x - b.x, a.y - b.y) };
  };

  // Un geste ne crée ni ne déplace jamais de borne : tap = inspection (au relâchement), glisser = navigation
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const target = e.target as HTMLElement | SVGElement;
    if (target.closest && (target.closest('aside') || target.closest('button') || target.closest('[data-canvas-card]'))) {
      return;
    }
    containerRef.current.focus({ preventScroll: true });
    const pos = localPos(e);
    pointersRef.current.set(e.pointerId, pos);
    try {
      containerRef.current.setPointerCapture(e.pointerId);
    } catch {
      /* non supporté */
    }

    if (pointersRef.current.size === 1) {
      gestureRef.current = { startX: pos.x, startY: pos.y, moved: false, multi: false, lastDist: 0, lastMidX: pos.x, lastMidY: pos.y };
    } else if (pointersRef.current.size === 2 && gestureRef.current) {
      const c = pointersCenter();
      gestureRef.current = { ...gestureRef.current, moved: true, multi: true, lastDist: c.dist, lastMidX: c.x, lastMidY: c.y };
      setIsPanning(true);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const g = gestureRef.current;
    if (!g || !pointersRef.current.has(e.pointerId)) return;
    const pos = localPos(e);
    pointersRef.current.set(e.pointerId, pos);

    if (pointersRef.current.size >= 2 && g.multi) {
      const c = pointersCenter();
      // Le point du plan sous l'ancien milieu des doigts suit le nouveau milieu : pan et zoom combinés
      const factor = g.lastDist > 0 ? c.dist / g.lastDist : 1;
      const nextScale = Math.min(100, Math.max(1, scale * factor));
      const wx = viewCenter.x + (g.lastMidX - dimensions.width / 2) / scale;
      const wy = viewCenter.y - (g.lastMidY - dimensions.height / 2) / scale;
      setScale(nextScale);
      setViewCenter({
        x: wx - (c.x - dimensions.width / 2) / nextScale,
        y: wy + (c.y - dimensions.height / 2) / nextScale,
      });
      g.lastDist = c.dist;
      g.lastMidX = c.x;
      g.lastMidY = c.y;
      return;
    }

    if (g.multi) return; // un doigt restant après un pincement : on ignore jusqu'au relâchement complet

    if (!g.moved) {
      if (Math.hypot(pos.x - g.startX, pos.y - g.startY) < TAP_SLOP_PX) return; // simple tremblement du doigt
      g.moved = true;
      g.lastMidX = g.startX;
      g.lastMidY = g.startY;
      setIsPanning(true);
    }

    const dx = pos.x - g.lastMidX;
    const dy = pos.y - g.lastMidY;
    setViewCenter((prev) => ({ x: prev.x - dx / scale, y: prev.y + dy / scale }));
    g.lastMidX = pos.x;
    g.lastMidY = pos.y;
  };

  const endPointer = (e: React.PointerEvent<HTMLDivElement>, cancelled: boolean) => {
    const g = gestureRef.current;
    if (!pointersRef.current.has(e.pointerId)) return;
    pointersRef.current.delete(e.pointerId);
    try {
      containerRef.current?.releasePointerCapture(e.pointerId);
    } catch {
      /* ignorer */
    }

    if (pointersRef.current.size === 0) {
      if (g && !g.moved && !g.multi && !cancelled) {
        // Tap franc : inspection de la borne touchée (désélection si fond)
        const hit = pointAt(g.startX, g.startY);
        setSelectedPointId(hit ? (hit.id === selectedPointId ? null : hit.id) : null);
      }
      gestureRef.current = null;
      setIsPanning(false);
    } else if (pointersRef.current.size === 1 && g?.multi) {
      // Fin du pincement : le doigt restant ne déclenche ni tap ni pan
      g.lastDist = 0;
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => endPointer(e, false);
  const handlePointerCancel = (e: React.PointerEvent<HTMLDivElement>) => endPointer(e, true);

  // Clavier (canevas focalisable) : flèches = déplacer la vue, +/− = zoom, 0 = tout cadrer, Échap = fermer l'inspection
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const stepM = 60 / scale; // 60 px en mètres
    switch (e.key) {
      case 'ArrowLeft':
        setViewCenter((v) => ({ ...v, x: v.x - stepM }));
        break;
      case 'ArrowRight':
        setViewCenter((v) => ({ ...v, x: v.x + stepM }));
        break;
      case 'ArrowUp':
        setViewCenter((v) => ({ ...v, y: v.y + stepM }));
        break;
      case 'ArrowDown':
        setViewCenter((v) => ({ ...v, y: v.y - stepM }));
        break;
      case '+':
      case '=':
        zoomAt(1.3, dimensions.width / 2, dimensions.height / 2);
        break;
      case '-':
      case '_':
        zoomAt(0.7, dimensions.width / 2, dimensions.height / 2);
        break;
      case '0':
        fitToScreen();
        break;
      case 'Escape':
        setSelectedPointId(null);
        break;
      case 'Tab': {
        // Tab / Maj+Tab : parcourt les bornes pour les inspecter au clavier
        if (points.length === 0) return;
        e.preventDefault();
        const i = points.findIndex((p) => p.id === selectedPointId);
        const next = e.shiftKey ? (i <= 0 ? points.length - 1 : i - 1) : (i + 1) % points.length;
        setSelectedPointId(points[next].id);
        break;
      }
      case 'Delete':
      case 'Backspace':
        if (selectedPointId) {
          e.preventDefault();
          onDeletePoint(selectedPointId);
          setSelectedPointId(null);
        }
        break;
      default:
        return;
    }
    if (e.key !== 'Tab') e.preventDefault();
  };

  const zoomAtRef = useRef(zoomAt);
  zoomAtRef.current = zoomAt;

  // Zoom à la molette (écouteur natif non passif pour pouvoir bloquer le défilement de la page)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      zoomAtRef.current(e.deltaY < 0 ? 1.15 : 0.85, e.clientX - rect.left, e.clientY - rect.top);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  // Génération de la grille métrique
  const gridLines = useCallback(() => {
    const lines: React.ReactNode[] = [];
    // Calculer le pas de grille visuel en mètres selon le zoom
    let gridStep = 5;
    if (scale > 25) gridStep = 1;
    else if (scale > 10) gridStep = 2;
    else if (scale < 4) gridStep = 20;

    const topLeft = screenToWorld(0, 0);
    const bottomRight = screenToWorld(dimensions.width, dimensions.height);

    const startX = Math.floor(topLeft.x / gridStep) * gridStep;
    const endX = Math.ceil(bottomRight.x / gridStep) * gridStep;
    const startY = Math.floor(bottomRight.y / gridStep) * gridStep;
    const endY = Math.ceil(topLeft.y / gridStep) * gridStep;

    // Lignes verticales
    for (let x = startX; x <= endX; x += gridStep) {
      const isMajor = x % (gridStep * 5) === 0 || x === 0;
      const screenPos = worldToScreen(x, 0);
      lines.push(
        <line
          key={`gx-${x}`}
          x1={screenPos.x}
          y1={0}
          x2={screenPos.x}
          y2={dimensions.height}
          stroke={x === 0 ? '#475569' : isMajor ? '#334155' : '#1e293b'}
          strokeWidth={x === 0 ? 1.5 : isMajor ? 1 : 0.5}
          strokeDasharray={x === 0 ? undefined : isMajor ? undefined : '2 4'}
          opacity={0.8}
        />
      );

      // Repère numérique en bas
      if (isMajor) {
        lines.push(
          <text
            key={`gtx-${x}`}
            x={screenPos.x + 3}
            y={dimensions.height - 6}
            fill="#64748b"
            fontSize="11"
            fontFamily="monospace"
            className="select-none pointer-events-none"
          >
            {x}m
          </text>
        );
      }
    }

    // Lignes horizontales
    for (let y = startY; y <= endY; y += gridStep) {
      const isMajor = y % (gridStep * 5) === 0 || y === 0;
      const screenPos = worldToScreen(0, y);
      lines.push(
        <line
          key={`gy-${y}`}
          x1={0}
          y1={screenPos.y}
          x2={dimensions.width}
          y2={screenPos.y}
          stroke={y === 0 ? '#475569' : isMajor ? '#334155' : '#1e293b'}
          strokeWidth={y === 0 ? 1.5 : isMajor ? 1 : 0.5}
          strokeDasharray={y === 0 ? undefined : isMajor ? undefined : '2 4'}
          opacity={0.8}
        />
      );

      // Repère numérique à gauche
      if (isMajor) {
        lines.push(
          <text
            key={`gty-${y}`}
            x={6}
            y={screenPos.y - 3}
            fill="#64748b"
            fontSize="11"
            fontFamily="monospace"
            className="select-none pointer-events-none"
          >
            {y}m
          </text>
        );
      }
    }

    return lines;
  }, [dimensions, scale, screenToWorld, worldToScreen]);

  // Points à l'écran
  const screenPoints = points.map((p) => ({
    ...p,
    ...worldToScreen(p.x, p.y),
  }));

  const polygonPath = screenPoints.reduce(
    (acc, p, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`,
    ''
  ) + (screenPoints.length >= 3 ? ' Z' : '');

  const centroidScreen = worldToScreen(metrics.centroid.x, metrics.centroid.y);
  const selectedPoint = points.find((p) => p.id === selectedPointId);
  const selectedGeo = selectedPoint ? getPointGeodetic(selectedPoint, originGeodetic) : null;
  const selectedUtm = selectedGeo ? toUtm(selectedGeo.lat, selectedGeo.lon) : null;

  return (
    <div className="relative flex-1 w-full h-full flex flex-row overflow-hidden bg-slate-950 select-none">
      {/* 1. Barre Latérale Dédiée Séparée du canevas de coordonnées */}
      <aside
        onPointerDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        className="w-13 sm:w-14 shrink-0 h-full border-r border-slate-800 bg-slate-900/95 flex flex-col items-center py-2.5 px-1 gap-2 z-20 select-none overflow-y-auto shadow-md"
        aria-label="Outils de contrôle du plan"
      >
        {/* Bouton d'Action Proéminent : Ajouter une Borne */}
        <div className="relative">
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              setIsAddMenuOpen((prev) => !prev);
            }}
            className={`flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-xl transition-all shadow-md active:scale-95 ${
              isAddMenuOpen
                ? 'bg-emerald-500 text-white ring-2 ring-emerald-400 ring-offset-2 ring-offset-slate-900'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-950/50'
            }`}
            aria-label="Ajouter une borne"
            title="Ajouter une borne (Satellite GNSS ou Saisie Manuelle)"
          >
            <Plus className={`h-6 w-6 transition-transform duration-200 ${isAddMenuOpen ? 'rotate-45' : ''}`} />
          </button>

          {/* Menu Popover Déroulant des Modes d'Ajout Sécurisés */}
          {isAddMenuOpen && (
            <div
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
              className="absolute left-13 sm:left-14 top-0 z-50 w-64 rounded-2xl border border-slate-700 bg-slate-900/98 p-2.5 shadow-2xl backdrop-blur-md animate-fade-in text-left flex flex-col gap-2"
            >
              <div className="flex items-center justify-between pb-1.5 border-b border-slate-800 px-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300">
                  Ajouter une Borne
                </span>
                <button
                  onClick={() => setIsAddMenuOpen(false)}
                  className="text-slate-500 hover:text-slate-300 p-0.5 rounded"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Option 1 : Acquisition GNSS Satellite */}
              <button
                onClick={() => {
                  setIsAddMenuOpen(false);
                  onOpenGpsModal();
                }}
                className="flex items-start gap-2.5 p-2 rounded-xl border border-cyan-500/30 bg-cyan-950/40 hover:bg-cyan-900/50 text-cyan-200 transition-all text-left group"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-cyan-500/20 text-cyan-300 group-hover:scale-105 transition-transform">
                  <Satellite className="h-5 w-5 animate-pulse" />
                </div>
                <div>
                  <div className="text-xs font-bold text-white flex items-center gap-1.5">
                    Par Satellite GNSS
                    <span className="text-[10px] bg-cyan-500/30 text-cyan-300 px-1.5 py-0.2 rounded font-mono">GPS</span>
                  </div>
                  <div className="text-[10px] text-cyan-300/80 leading-tight mt-0.5">
                    Acquisition multi-constellation & moyenne haute précision
                  </div>
                </div>
              </button>

              {/* Option 2 : Saisie Manuelle de Coordonnées */}
              <button
                onClick={() => {
                  setIsAddMenuOpen(false);
                  if (onOpenManualInput) {
                    onOpenManualInput();
                  }
                }}
                className="flex items-start gap-2.5 p-2 rounded-xl border border-emerald-500/30 bg-emerald-950/40 hover:bg-emerald-900/50 text-emerald-200 transition-all text-left group"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-300 group-hover:scale-105 transition-transform">
                  <MapPin className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-xs font-bold text-white flex items-center gap-1.5">
                    Saisie Coordonnées
                    <span className="text-[10px] bg-emerald-500/30 text-emerald-300 px-1.5 py-0.2 rounded font-mono">X / Y / GPS</span>
                  </div>
                  <div className="text-[10px] text-emerald-300/80 leading-tight mt-0.5">
                    Formulaire métrique ou géodésique avec carnet de bornes
                  </div>
                </div>
              </button>
            </div>
          )}
        </div>

        <div className="w-8 h-[1px] bg-slate-800 my-0.5" />

        {/* Bouton Raccourci Acquisition Satellite GNSS */}
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onOpenGpsModal();
          }}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-500/40 bg-cyan-500/10 text-cyan-300 shadow-sm hover:bg-cyan-500/20 active:scale-95 transition-all"
          aria-label="Acquérir une borne par GPS"
            title="Planter une borne par GPS / Multi-Satellites"
        >
          <Satellite className="h-5 w-5 animate-pulse" />
        </button>

        {/* Bouton Centrer sur ma position GPS si active */}
        {gpsPosition && (
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              setViewCenter({ x: gpsPosition.x, y: gpsPosition.y });
            }}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-500/50 bg-slate-950 text-cyan-400 shadow-sm hover:bg-slate-800"
            aria-label="Centrer sur ma position GPS"
            title="Centrer sur ma position GPS"
          >
            <Crosshair className="h-5 w-5" />
          </button>
        )}

        {/* Annuler / Rétablir */}
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onUndo();
          }}
          disabled={!canUndo}
          aria-label="Annuler"
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-800 bg-slate-950 text-slate-300 shadow-sm hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-slate-950"
          title="Annuler (Ctrl+Z)"
        >
          <Undo2 className="h-5 w-5" />
        </button>
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onRedo();
          }}
          disabled={!canRedo}
          aria-label="Rétablir"
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-800 bg-slate-950 text-slate-300 shadow-sm hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-slate-950"
          title="Rétablir (Ctrl+Shift+Z)"
        >
          <Redo2 className="h-5 w-5" />
        </button>

        <div className="w-8 h-[1px] bg-slate-800 my-0.5" />

        {/* Zoom In */}
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            zoomAt(1.3, dimensions.width / 2, dimensions.height / 2);
          }}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-800 bg-slate-950 text-slate-300 shadow-sm hover:bg-slate-800"
          aria-label="Zoomer"
            title="Zoomer (+)"
        >
          <ZoomIn className="h-5 w-5" />
        </button>

        {/* Zoom Out */}
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            zoomAt(0.7, dimensions.width / 2, dimensions.height / 2);
          }}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-800 bg-slate-950 text-slate-300 shadow-sm hover:bg-slate-800"
          aria-label="Dézoomer"
            title="Dézoomer (-)"
        >
          <ZoomOut className="h-5 w-5" />
        </button>

        {/* Recentrer tout / Fit to screen */}
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            fitToScreen();
          }}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-800 bg-slate-950 text-slate-300 shadow-sm hover:bg-slate-800 mt-auto"
          aria-label="Recentrer le relevé"
            title="Recentrer le métré complet"
        >
          <Maximize2 className="h-5 w-5" />
        </button>
      </aside>

      {/* 2. Zone Canevas Vectoriel Propre et Dédiée */}
      <div
        ref={containerRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        role="application"
        aria-label="Plan du relevé. Flèches : déplacer. Plus et moins : zoom. Tabulation : parcourir les bornes. Zéro : tout cadrer."
        className={`relative flex-1 h-full overflow-hidden bg-slate-950 touch-none select-none outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 focus-visible:ring-inset ${
          isPanning ? 'cursor-grabbing' : 'cursor-grab'
        }`}
      >
        {/* Bandeau d'état et d'aide au sommet du canevas */}
        <div role="status" className="absolute top-2.5 left-1/2 -translate-x-1/2 z-10 pointer-events-none px-3.5 py-1.5 rounded-full bg-slate-900/90 border border-slate-800 text-[11px] font-medium text-slate-300 shadow-md backdrop-blur-sm flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-emerald-400" />
          <span>
            {selectedPoint
              ? `Borne ${selectedPoint.name} inspectée · Glissez pour naviguer`
              : points.length === 0
                ? 'Touchez [+] pour ajouter la première borne'
                : 'Glissez pour naviguer · Touchez une borne pour l’inspecter'}
          </span>
        </div>
      {/* SVG Canvas Principal */}
      <svg className="w-full h-full block" role="img" aria-label={`Plan : ${points.length} borne${points.length > 1 ? 's' : ''}, superficie ${metrics.areaM2.toFixed(2)} mètres carrés`}>
        {/* Grille Métrique */}
        {gridLines()}

        {/* Tracé de la surface / polygone */}
        {screenPoints.length >= 3 && (
          <path
            d={polygonPath}
            fill={metrics.isSelfIntersecting ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.20)'}
            stroke={metrics.isSelfIntersecting ? '#ef4444' : '#10b981'}
            strokeWidth="3"
            strokeLinejoin="round"
            className="transition-colors duration-150"
          />
        )}

        {/* Lignes ouvertes pour 2 points */}
        {screenPoints.length === 2 && (
          <line
            x1={screenPoints[0].x}
            y1={screenPoints[0].y}
            x2={screenPoints[1].x}
            y2={screenPoints[1].y}
            stroke="#10b981"
            strokeWidth="2.5"
            strokeDasharray="4 4"
          />
        )}

        {/* Lignes de décomposition en triangles (Héron) */}
        {screenPoints.length > 3 &&
          metrics.triangles.map((tri) => {
            const sp1 = worldToScreen(tri.p1.x, tri.p1.y);
            const sp2 = worldToScreen(tri.p2.x, tri.p2.y);
            const sp3 = worldToScreen(tri.p3.x, tri.p3.y);
            return (
              <polygon
                key={tri.id}
                points={`${sp1.x},${sp1.y} ${sp2.x},${sp2.y} ${sp3.x},${sp3.y}`}
                fill="none"
                stroke="#38bdf8"
                strokeWidth="0.8"
                strokeDasharray="3 3"
                opacity="0.4"
              />
            );
          })}

        {/* Cotations des segments */}
        {metrics.edges.map((edge, idx) => {
          const midScreen = worldToScreen(edge.midpoint.x, edge.midpoint.y);
          // Angle d'affichage du texte pour être toujours lisible
          let textAngle = edge.angleDeg;
          if (textAngle > 90 && textAngle <= 270) {
            textAngle -= 180;
          }

          return (
            <g
              key={`edge-${idx}`}
              transform={`translate(${midScreen.x}, ${midScreen.y}) rotate(${-textAngle})`}
              className="pointer-events-none"
            >
              <rect
                x="-26"
                y="-9"
                width="52"
                height="16"
                rx="4"
                fill="#0f172a"
                fillOpacity="0.85"
                stroke="#334155"
                strokeWidth="0.5"
              />
              <text
                x="0"
                y="3"
                textAnchor="middle"
                fill="#f8fafc"
                fontSize="11"
                fontWeight="600"
                fontFamily="monospace"
              >
                {edge.length.toFixed(2)}m
              </text>
            </g>
          );
        })}

        {/* Badge Centroïde & Aire au milieu de la parcelle */}
        {points.length >= 3 && metrics.areaM2 > 0 && (
          <g transform={`translate(${centroidScreen.x}, ${centroidScreen.y})`} className="pointer-events-none">
            <circle cx="0" cy="0" r="14" fill="#0f172a" stroke="#10b981" strokeWidth="2" opacity="0.9" />
            <circle cx="0" cy="0" r="4" fill="#10b981" />
          </g>
        )}

        {/* Sommets / Bornes interactives (Sélection & Inspection en lecture seule) */}
        {screenPoints.map((p, idx) => {
          const isSelected = p.id === selectedPointId;
          return (
            <g key={p.id} className="cursor-pointer">
              {/* Cible tactile invisible élargie (minimum 44x44px pour le pouce) */}
              <circle cx={p.x} cy={p.y} r="24" fill="transparent" />

              {/* Halo d'état sélectionné */}
              {isSelected && (
                <circle cx={p.x} cy={p.y} r="20" fill="#f59e0b" fillOpacity="0.3" stroke="#f59e0b" strokeWidth="2" />
              )}

              {/* Borne visuelle */}
              <circle
                cx={p.x}
                cy={p.y}
                r="7"
                fill="#0f172a"
                stroke={isSelected ? '#f59e0b' : '#10b981'}
                strokeWidth={isSelected ? '3.5' : '2.5'}
              />
              <circle cx={p.x} cy={p.y} r="2.5" fill={isSelected ? '#f59e0b' : '#34d399'} />

              {/* Étiquette nom de la borne */}
              <rect
                x={p.x + 9}
                y={p.y - 18}
                width={p.name.length * 7 + 10}
                height="15"
                rx="3"
                fill="#0f172a"
                fillOpacity="0.85"
                stroke={isSelected ? '#f59e0b' : '#334155'}
                strokeWidth={isSelected ? '1' : '0.5'}
                className="pointer-events-none"
              />
              <text
                x={p.x + 14}
                y={p.y - 7}
                fill={isSelected ? '#fcd34d' : '#e2e8f0'}
                fontSize="11"
                fontWeight="bold"
                fontFamily="monospace"
                className="pointer-events-none"
              >
                {p.name || `P${idx + 1}`}
              </text>
            </g>
          );
        })}
        {/* Position GPS actuelle en direct avec cercle d'incertitude */}
        {gpsPosition && (() => {
          const screenGps = worldToScreen(gpsPosition.x, gpsPosition.y);
          const radiusPixels = Math.max(10, gpsPosition.accuracy * scale);
          return (
            <g className="pointer-events-none">
              <circle
                cx={screenGps.x}
                cy={screenGps.y}
                r={radiusPixels}
                fill="#06b6d4"
                fillOpacity="0.15"
                stroke="#06b6d4"
                strokeWidth="1.5"
                strokeDasharray="4 3"
              />
              <circle cx={screenGps.x} cy={screenGps.y} r="7" fill="#0284c7" stroke="#ffffff" strokeWidth="2" />
              <circle cx={screenGps.x} cy={screenGps.y} r="14" fill="none" stroke="#38bdf8" strokeWidth="1.5" opacity="0.6">
                <animate attributeName="r" values="7;22;7" dur="2.5s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.8;0.1;0.8" dur="2.5s" repeatCount="indefinite" />
              </circle>
              <rect
                x={screenGps.x + 10}
                y={screenGps.y - 12}
                width="72"
                height="15"
                rx="3"
                fill="#0f172a"
                fillOpacity="0.9"
                stroke="#0284c7"
                strokeWidth="0.5"
              />
              <text
                x={screenGps.x + 14}
                y={screenGps.y - 1}
                fill="#38bdf8"
                fontSize="10"
                fontWeight="bold"
                fontFamily="monospace"
              >
                Moi (±{gpsPosition.accuracy.toFixed(1)}m)
              </text>
            </g>
          );
        })()}
      </svg>

      {/* Fiche d'Inspection de la Borne Sélectionnée (Mode Lecture Seule) */}
      {selectedPoint && (
        <div
          data-canvas-card
          onPointerDown={(e) => e.stopPropagation()}
          className="absolute bottom-3 left-1/2 -translate-x-1/2 z-30 max-w-sm w-[92%] rounded-2xl border border-amber-500/40 bg-slate-900/98 p-3 shadow-2xl backdrop-blur-md animate-fade-in flex flex-col gap-2"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 rounded-full bg-amber-500/20 border border-amber-500/50 flex items-center justify-center text-amber-400 font-bold font-mono text-xs">
                {selectedPoint.name}
              </div>
              <div>
                <span className="text-xs font-bold text-white block">Borne Inspectée</span>
                <span className="text-[10px] text-slate-400">Position verrouillée · modification via le carnet de bornes</span>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => {
                  onDeletePoint(selectedPoint.id);
                  setSelectedPointId(null);
                }}
                aria-label="Supprimer cette borne"
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 transition-colors"
                title="Supprimer cette borne (annulable)"
              >
                <Trash2 className="h-4 w-4" />
              </button>
              <button
                onClick={() => setSelectedPointId(null)}
                aria-label="Fermer l'inspection"
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                title="Fermer l'inspection"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[11px] font-mono bg-slate-950/80 p-2.5 rounded-xl border border-slate-800/80">
            <div>
              <span className="text-slate-400 text-[10px] block uppercase font-sans">Métrique Local</span>
              <span className="text-amber-300 font-semibold">X: {selectedPoint.x.toFixed(2)} m</span>
              <br />
              <span className="text-amber-300 font-semibold">Y: {selectedPoint.y.toFixed(2)} m</span>
            </div>
            <div>
              <span className="text-slate-400 text-[10px] block uppercase font-sans">Coordonnées WGS84</span>
              {selectedGeo ? (
                <>
                  <span className="text-cyan-300">Lat: {selectedGeo.lat.toFixed(6)}°</span>
                  <br />
                  <span className="text-cyan-300">Lon: {selectedGeo.lon.toFixed(6)}°</span>
                </>
              ) : (
                <span className="text-slate-500 italic">Non géoréférencée</span>
              )}
            </div>
            {selectedUtm && (
              <div className="col-span-2">
                <span className="text-slate-400 text-[10px] block uppercase font-sans">UTM (WGS84)</span>
                <span className="text-emerald-300">{formatUtm(selectedUtm)}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Boussole / Rose des vents discrète (Nord en haut) */}
      <div className="absolute top-3 right-3 pointer-events-none flex flex-col items-center bg-slate-900/80 border border-slate-800 rounded-lg p-1.5 backdrop-blur-sm">
        <span className="text-[10px] font-bold text-rose-500 font-mono">N</span>
        <div className="w-0.5 h-4 bg-gradient-to-b from-rose-500 to-slate-600 rounded-full my-0.5" />
        <span className="text-[8px] font-mono text-slate-500">0°</span>
      </div>

      {/* Échelle graphique en bas à gauche */}
      <div className="absolute bottom-3 left-3 pointer-events-none flex items-center gap-2 bg-slate-900/85 border border-slate-800 rounded-md px-2.5 py-1 backdrop-blur-sm">
        <div
          style={{ width: `${Math.max(20, Math.min(100, scale * 5))}px` }}
          className="h-1 bg-emerald-400 border-x border-white"
        />
        <span className="text-[10px] font-mono text-slate-300">5 m</span>
      </div>

      </div>
    </div>
  );
};
