import React, { useState } from 'react';
import { Point2D } from '../../types/survey';
import { generateCanonicalShape } from '../../utils/geometryEngine';
import { Square, Triangle as TriangleIcon, Circle, Shield, X, Check } from 'lucide-react';

interface ShapesDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyShape: (points: Point2D[]) => void;
}

type ShapeTab = 'rectangle' | 'triangle' | 'trapezoid' | 'circle' | 'regular_poly';

export const ShapesDrawer: React.FC<ShapesDrawerProps> = ({
  isOpen,
  onClose,
  onApplyShape,
}) => {
  const [selectedShape, setSelectedShape] = useState<ShapeTab>('rectangle');

  // Paramètres
  const [rectWidth, setRectWidth] = useState<number>(30);
  const [rectHeight, setRectHeight] = useState<number>(20);

  const [triBase, setTriBase] = useState<number>(30);
  const [triHeight, setTriHeight] = useState<number>(25);

  const [trapBase1, setTrapBase1] = useState<number>(40);
  const [trapBase2, setTrapBase2] = useState<number>(20);
  const [trapHeight, setTrapHeight] = useState<number>(25);

  const [circleRadius, setCircleRadius] = useState<number>(20);

  const [polySides, setPolySides] = useState<number>(6);
  const [polyRadius, setPolyRadius] = useState<number>(25);

  if (!isOpen) return null;

  const handleGenerate = () => {
    let generated: Point2D[] = [];

    switch (selectedShape) {
      case 'rectangle':
        generated = generateCanonicalShape('rectangle', {
          width: rectWidth,
          height: rectHeight,
        });
        break;
      case 'triangle':
        generated = generateCanonicalShape('triangle', {
          width: triBase,
          height: triHeight,
        });
        break;
      case 'trapezoid':
        generated = generateCanonicalShape('trapezoid', {
          base1: trapBase1,
          base2: trapBase2,
          height: trapHeight,
        });
        break;
      case 'circle':
        generated = generateCanonicalShape('circle', {
          radius: circleRadius,
        });
        break;
      case 'regular_poly':
        generated = generateCanonicalShape('regular_poly', {
          sides: polySides,
          radius: polyRadius,
        });
        break;
    }

    onApplyShape(generated);
    onClose();
  };

  // Calcul préliminaire de l'aire théorique de la forme
  let previewArea = 0;
  if (selectedShape === 'rectangle') previewArea = rectWidth * rectHeight;
  else if (selectedShape === 'triangle') previewArea = (triBase * triHeight) / 2;
  else if (selectedShape === 'trapezoid') previewArea = ((trapBase1 + trapBase2) * trapHeight) / 2;
  else if (selectedShape === 'circle') previewArea = Math.PI * circleRadius * circleRadius;
  else if (selectedShape === 'regular_poly') {
    previewArea = 0.5 * polySides * polyRadius * polyRadius * Math.sin((2 * Math.PI) / polySides);
  }

  return (
    <div className="fixed inset-0 z-40 flex flex-col justify-end bg-black/60 backdrop-blur-xs">
      <div className="mx-auto w-full md:max-w-2xl rounded-t-3xl border-t border-slate-800 bg-slate-900 p-4 shadow-2xl max-h-[85dvh] flex flex-col">
        {/* Poignée de tiroir & En-tête */}
        <div className="mx-auto mb-2 h-1.5 w-12 rounded-full bg-slate-700" />
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div>
            <h2 className="text-base font-bold text-white">Formes Géométriques Canoniques</h2>
            <p className="text-xs text-slate-400">Insérez une forme standard avec cotes prédéfinies</p>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-800 text-slate-400 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Sélecteur de forme tactile */}
        <div className="grid grid-cols-5 gap-1.5 py-3">
          <button
            onClick={() => setSelectedShape('rectangle')}
            className={`flex flex-col items-center justify-center py-2.5 rounded-xl border text-xs transition-colors ${
              selectedShape === 'rectangle'
                ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400 font-semibold'
                : 'border-slate-800 bg-slate-800/40 text-slate-400'
            }`}
          >
            <Square className="h-5 w-5 mb-1" />
            <span>Rectangle</span>
          </button>

          <button
            onClick={() => setSelectedShape('triangle')}
            className={`flex flex-col items-center justify-center py-2.5 rounded-xl border text-xs transition-colors ${
              selectedShape === 'triangle'
                ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400 font-semibold'
                : 'border-slate-800 bg-slate-800/40 text-slate-400'
            }`}
          >
            <TriangleIcon className="h-5 w-5 mb-1" />
            <span>Triangle</span>
          </button>

          <button
            onClick={() => setSelectedShape('trapezoid')}
            className={`flex flex-col items-center justify-center py-2.5 rounded-xl border text-xs transition-colors ${
              selectedShape === 'trapezoid'
                ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400 font-semibold'
                : 'border-slate-800 bg-slate-800/40 text-slate-400'
            }`}
          >
            <div className="w-5 h-5 flex items-center justify-center font-bold text-xs">⏢</div>
            <span>Trapèze</span>
          </button>

          <button
            onClick={() => setSelectedShape('circle')}
            className={`flex flex-col items-center justify-center py-2.5 rounded-xl border text-xs transition-colors ${
              selectedShape === 'circle'
                ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400 font-semibold'
                : 'border-slate-800 bg-slate-800/40 text-slate-400'
            }`}
          >
            <Circle className="h-5 w-5 mb-1" />
            <span>Cercle</span>
          </button>

          <button
            onClick={() => setSelectedShape('regular_poly')}
            className={`flex flex-col items-center justify-center py-2.5 rounded-xl border text-xs transition-colors ${
              selectedShape === 'regular_poly'
                ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400 font-semibold'
                : 'border-slate-800 bg-slate-800/40 text-slate-400'
            }`}
          >
            <Shield className="h-5 w-5 mb-1" />
            <span>Polygone</span>
          </button>
        </div>

        {/* Paramètres selon la forme */}
        <div className="flex-1 overflow-y-auto py-2 space-y-3">
          {selectedShape === 'rectangle' && (
            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Largeur / Façade (mètres)</label>
                <input
                  type="number"
                  min="1"
                  max="1000"
                  step="1"
                  value={rectWidth}
                  onChange={(e) => setRectWidth(Math.max(1, Number(e.target.value)))}
                  className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm font-mono text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Longueur / Profondeur (mètres)</label>
                <input
                  type="number"
                  min="1"
                  max="1000"
                  step="1"
                  value={rectHeight}
                  onChange={(e) => setRectHeight(Math.max(1, Number(e.target.value)))}
                  className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm font-mono text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>
          )}

          {selectedShape === 'triangle' && (
            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Base du triangle (mètres)</label>
                <input
                  type="number"
                  min="1"
                  max="1000"
                  value={triBase}
                  onChange={(e) => setTriBase(Math.max(1, Number(e.target.value)))}
                  className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm font-mono text-white"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Hauteur perpendiculaire (mètres)</label>
                <input
                  type="number"
                  min="1"
                  max="1000"
                  value={triHeight}
                  onChange={(e) => setTriHeight(Math.max(1, Number(e.target.value)))}
                  className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm font-mono text-white"
                />
              </div>
            </div>
          )}

          {selectedShape === 'trapezoid' && (
            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Grande base B (mètres)</label>
                <input
                  type="number"
                  min="1"
                  max="1000"
                  value={trapBase1}
                  onChange={(e) => setTrapBase1(Math.max(1, Number(e.target.value)))}
                  className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm font-mono text-white"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Petite base b (mètres)</label>
                <input
                  type="number"
                  min="1"
                  max="1000"
                  value={trapBase2}
                  onChange={(e) => setTrapBase2(Math.max(1, Number(e.target.value)))}
                  className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm font-mono text-white"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Hauteur h (mètres)</label>
                <input
                  type="number"
                  min="1"
                  max="1000"
                  value={trapHeight}
                  onChange={(e) => setTrapHeight(Math.max(1, Number(e.target.value)))}
                  className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm font-mono text-white"
                />
              </div>
            </div>
          )}

          {selectedShape === 'circle' && (
            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Rayon du cercle (mètres)</label>
                <input
                  type="number"
                  min="1"
                  max="500"
                  value={circleRadius}
                  onChange={(e) => setCircleRadius(Math.max(1, Number(e.target.value)))}
                  className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm font-mono text-white"
                />
              </div>
              <p className="text-[11px] text-slate-500">
                Génère un contour polygonal régulier de 24 bornes pour un calcul vectoriel précis.
              </p>
            </div>
          )}

          {selectedShape === 'regular_poly' && (
            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Nombre de côtés (3 à 12)</label>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="3"
                    max="12"
                    value={polySides}
                    onChange={(e) => setPolySides(Number(e.target.value))}
                    className="flex-1 accent-emerald-500"
                  />
                  <span className="w-8 text-center font-mono font-bold text-white text-sm">
                    {polySides}
                  </span>
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Rayon circonscrit (mètres)</label>
                <input
                  type="number"
                  min="1"
                  max="500"
                  value={polyRadius}
                  onChange={(e) => setPolyRadius(Math.max(1, Number(e.target.value)))}
                  className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm font-mono text-white"
                />
              </div>
            </div>
          )}

          {/* Synthèse calculée */}
          <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Superficie théorique :</span>
              <span className="text-emerald-400 font-mono font-bold text-sm">
                {previewArea.toFixed(2)} m²
              </span>
            </div>
            {previewArea >= 100 && (
              <div className="text-right text-[11px] font-mono text-slate-500 mt-0.5">
                {(previewArea / 10000).toFixed(4)} ha ({Math.floor(previewArea / 100)} ares)
              </div>
            )}
          </div>
        </div>

        {/* Bouton de validation tactile */}
        <div className="pt-3 border-t border-slate-800">
          <button
            onClick={handleGenerate}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 text-sm font-bold text-white shadow-lg shadow-emerald-900/30 hover:bg-emerald-500 active:scale-[0.98] transition-transform"
          >
            <Check className="h-4 w-4" />
            Appliquer sur le Canevas
          </button>
        </div>
      </div>
    </div>
  );
};
