import React, { useState, useEffect } from 'react';
import {
  Satellite,
  Radio,
  Check,
  X,
  RefreshCw,
  AlertCircle,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  MapPin,
  Sparkles,
  Play,
} from 'lucide-react';
import { useDeviceGps } from '../hooks/useDeviceGps';
import { formatDms } from '../utils/satelliteEngine';
import { parseDecimal } from '../utils/numbers';

interface GpsAveragingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmPoint: (coords: {
    lat: number;
    lon: number;
    altitude: number;
    /** Absente pour une saisie manuelle : aucune précision n'est revendiquée */
    accuracy?: number;
    fixCount: number;
    name: string;
    source: 'gnss' | 'manual' | 'simulated';
  }) => void;
  defaultPointName?: string;
}

export const GpsAveragingModal: React.FC<GpsAveragingModalProps> = ({
  isOpen,
  onClose,
  onConfirmPoint,
  defaultPointName = 'Borne GNSS',
}) => {
  const {
    isSupported,
    isTracking,
    isAcquiring,
    isSimulated,
    permissionState,
    currentFix,
    stabilizedFix,
    sampleCount,
    error,
    requestPermissionAndStart,
    startSimulation,
    startTracking,
    stopTracking,
    resetSamples,
    clearError,
  } = useDeviceGps();

  const [pointName, setPointName] = useState(defaultPointName);
  const [showHelpGuide, setShowHelpGuide] = useState(false);
  const [manualMode, setManualMode] = useState(false);

  // Saisie manuelle de secours
  const [manualLat, setManualLat] = useState<string>('');
  const [manualLon, setManualLon] = useState<string>('');
  const [manualAlt, setManualAlt] = useState<string>('0');

  const targetSamples = 20;

  // La simulation GNSS n'existe qu'en développement : jamais dans l'application déployée
  const simulationEnabled = import.meta.env.DEV;
  const insecureContext = typeof window !== 'undefined' && !window.isSecureContext;

  useEffect(() => {
    if (isOpen) {
      setPointName(defaultPointName);
      resetSamples();
      clearError();
      setShowHelpGuide(false);
      setManualMode(false);

      // Si l'accès est déjà accordé précédemment, lancer la surveillance
      if (permissionState === 'granted') {
        startTracking();
      }
    } else {
      stopTracking();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const activeFix = stabilizedFix || currentFix;
  const progressPercent = Math.min(100, (sampleCount / targetSamples) * 100);

  const handleStartCapture = async () => {
    clearError();
    await requestPermissionAndStart();
  };

  const handleStartSimulation = () => {
    clearError();
    startSimulation(3.848, 11.5021);
  };

  const handleConfirm = () => {
    if (manualMode) {
      const lat = parseDecimal(manualLat);
      const lon = parseDecimal(manualLon);
      const alt = parseDecimal(manualAlt) ?? 0;
      if (lat === null || lon === null || Math.abs(lat) > 90 || Math.abs(lon) > 180) return;

      onConfirmPoint({
        lat,
        lon,
        altitude: alt,
        fixCount: 1,
        name: pointName.trim(),
        source: 'manual',
      });
      onClose();
      return;
    }

    if (!activeFix) return;
    onConfirmPoint({
      lat: activeFix.lat,
      lon: activeFix.lon,
      altitude: activeFix.altitude || 0,
      accuracy: activeFix.accuracy,
      fixCount: sampleCount || 1,
      name: pointName.trim(),
      source: isSimulated ? 'simulated' : 'gnss',
    });
    onClose();
  };

  // Qualité du signal GNSS
  let qualityLabel = isSimulated ? 'Mode Simulation Satellite' : 'Recherche des constellations...';
  let qualityColor = 'text-slate-400 border-slate-700 bg-slate-800';
  if (activeFix) {
    if (isSimulated) {
      qualityLabel = 'Position simulée étalonnée';
      qualityColor = 'text-purple-400 border-purple-500/30 bg-purple-500/10';
    } else if (activeFix.accuracy <= 2.0) {
      qualityLabel = 'Excellente (Précision submétrique)';
      qualityColor = 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10';
    } else if (activeFix.accuracy <= 5.0) {
      qualityLabel = 'Bonne (Tolérance topographique)';
      qualityColor = 'text-cyan-400 border-cyan-500/30 bg-cyan-500/10';
    } else {
      qualityLabel = 'Signal modéré (Restez immobile)';
      qualityColor = 'text-amber-400 border-amber-500/30 bg-amber-500/10';
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 backdrop-blur-sm overflow-y-auto">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-2xl text-slate-100 flex flex-col my-auto max-h-[90vh]">
        {/* En-tête */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
              <Satellite className={`h-5 w-5 ${isTracking ? 'animate-pulse' : ''}`} />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Acquisition Satellite GNSS</h2>
              <p className="text-[11px] text-slate-400">Multi-constellations (GPS, Galileo, Glonass, BeiDou)</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Fermer"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-800 text-slate-400 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Corps */}
        <div className="py-3.5 space-y-3 overflow-y-auto flex-1">
          {/* Nom de la borne */}
          <div>
            <label className="text-[11px] text-slate-400 block mb-1">Désignation de la borne</label>
            <input
              type="text"
              value={pointName}
              onChange={(e) => setPointName(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-semibold text-white focus:outline-none focus:border-cyan-500"
            />
          </div>

          {insecureContext && (
            <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-2.5 text-[11px] text-amber-200">
              Cette page n’est pas servie en HTTPS : le navigateur bloquera le GPS. Utilisez l’adresse sécurisée de l’application.
            </div>
          )}

          {/* État 1 : Erreur ou Blocage d'autorisation */}
          {error && (
            <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-3.5 space-y-3">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
                <div className="text-xs text-rose-200 leading-relaxed">
                  <strong className="block font-semibold text-rose-300 mb-0.5">Accès GPS non accordé</strong>
                  {error}
                </div>
              </div>

              {/* Actions de déblocage direct */}
              <div className="space-y-2 pt-1">
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleStartCapture}
                    disabled={isAcquiring}
                    className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-cyan-600 px-3 py-2.5 text-xs font-bold text-white hover:bg-cyan-500 active:scale-95 transition shadow-sm"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${isAcquiring ? 'animate-spin' : ''}`} />
                    <span>{isAcquiring ? 'Détection...' : 'Réessayer l’accès GPS'}</span>
                  </button>

                  <button
                    onClick={() => setShowHelpGuide(!showHelpGuide)}
                    className="flex items-center gap-1 rounded-xl border border-slate-700 bg-slate-800 px-3 py-2.5 text-xs text-slate-300 hover:text-white"
                  >
                    <HelpCircle className="h-3.5 w-3.5 text-cyan-400" />
                    <span>Aide</span>
                    {showHelpGuide ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  </button>
                </div>

                {/* Simulation : développement uniquement */}
                {simulationEnabled && (
                  <button
                    onClick={handleStartSimulation}
                    className="w-full flex items-center justify-center gap-2 rounded-xl border border-purple-500/40 bg-purple-500/10 px-3 py-2 text-xs font-semibold text-purple-300 hover:bg-purple-500/20 transition"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>[DEV] Position GPS simulée</span>
                  </button>
                )}
              </div>

              {/* Guide de déblocage pas à pas */}
              {showHelpGuide && (
                <div className="mt-2 rounded-xl bg-slate-950/90 p-3 text-[11px] text-slate-300 space-y-2 border border-slate-800">
                  <div className="font-semibold text-white">Pourquoi ce message apparaît-il ?</div>
                  <ul className="space-y-1.5 pl-4 list-disc text-slate-400">
                    <li>
                      <strong className="text-slate-200">Connexion sécurisée</strong> : la géolocalisation exige une adresse en <code className="text-cyan-300 font-mono">https://</code> (ou localhost).
                    </li>
                    <li>
                      <strong className="text-slate-200">Autorisation du site</strong> : Cliquez sur l'icône de réglages/cadenas à gauche de l'adresse web <code className="text-cyan-300 font-mono">https://...</code> et activez <em>Position / Localisation</em>.
                    </li>
                    <li>
                      <strong className="text-slate-200">Mobile Safari / Chrome</strong> : Vérifiez dans les Réglages du téléphone que le service de localisation est activé pour le navigateur.
                    </li>
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* État 2 : Pas encore d'acquisition lancée et pas d'erreur */}
          {!activeFix && !error && !isAcquiring && (
            <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4 text-center space-y-3">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                <Satellite className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white mb-1">Prêt pour l'acquisition GNSS</h3>
                <p className="text-xs text-slate-400">
                  L'application va interroger les constellations de satellites en direct pour mesurer cette borne.
                </p>
              </div>

              <div className="space-y-2 pt-1">
                <button
                  onClick={handleStartCapture}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-cyan-600 py-3 text-xs font-bold text-white shadow-lg shadow-cyan-900/40 hover:bg-cyan-500 active:scale-[0.98] transition"
                >
                  <Play className="h-4 w-4" />
                  <span>Démarrer l'acquisition Satellite</span>
                </button>

                {simulationEnabled && (
                  <button
                    onClick={handleStartSimulation}
                    className="w-full flex items-center justify-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800"
                  >
                    <Sparkles className="h-3.5 w-3.5 text-purple-400" />
                    <span>[DEV] Simuler un relevé satellite</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Commutateur mode manuel de secours */}
          <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
            <span>Autre méthode :</span>
            <button
              onClick={() => setManualMode(!manualMode)}
              className="text-cyan-400 font-semibold hover:underline flex items-center gap-1"
            >
              <MapPin className="h-3 w-3" />
              <span>{manualMode ? 'Revenir au mode Satellite' : 'Saisie manuelle Lat/Lon'}</span>
            </button>
          </div>

          {/* Mode Saisie Manuelle de Secours */}
          {manualMode ? (
            <div className="rounded-2xl border border-cyan-500/30 bg-cyan-500/10 p-3.5 space-y-2.5">
              <span className="text-xs font-bold text-cyan-300 block">Saisie directe des coordonnées de la borne</span>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">Latitude (° Décimaux)</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="Ex: 3.848000"
                    value={manualLat}
                    onChange={(e) => setManualLat(e.target.value)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">Longitude (° Décimaux)</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="Ex: 11.502100"
                    value={manualLon}
                    onChange={(e) => setManualLon(e.target.value)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>
              <div>
                <label className="text-[10px] text-slate-400 block mb-1">Altitude (mètres)</label>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="Ex: 142.5"
                  value={manualAlt}
                  onChange={(e) => setManualAlt(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>
          ) : (
            /* Carte Télémétrique active si acquisition en cours */
            (activeFix || isAcquiring) && (
              <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4 space-y-3">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400">Statut du signal :</span>
                  <span className={`px-2 py-0.5 rounded-full border text-[11px] font-semibold ${qualityColor}`}>
                    {qualityLabel}
                  </span>
                </div>

                {/* Jauge de progression du moyennage */}
                <div>
                  <div className="flex justify-between text-[11px] font-mono text-slate-400 mb-1">
                    <span>Échantillons satellites intégrés :</span>
                    <span className="font-bold text-cyan-400">
                      {sampleCount} / {targetSamples}
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
                    <div
                      style={{ width: `${progressPercent}%` }}
                      className="h-full bg-gradient-to-r from-cyan-500 to-emerald-400 transition-all duration-300"
                    />
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1">
                    {isSimulated
                      ? 'Données simulées (développement) : ne pas utiliser pour un relevé réel.'
                      : 'Moyenne pondérée par l’inverse de la variance, avec rejet des fixes aberrants. La précision affichée est prudente.'}
                  </p>
                </div>

                {/* Lecture des coordonnées en direct */}
                {activeFix ? (
                  <div className="space-y-1.5 pt-2 border-t border-slate-800/80 font-mono text-xs">
                    <div className="flex justify-between text-slate-300">
                      <span className="text-slate-500">Latitude :</span>
                      <strong className="text-white">{activeFix.lat.toFixed(7)}°</strong>
                    </div>
                    <div className="flex justify-between text-slate-300">
                      <span className="text-slate-500">Longitude :</span>
                      <strong className="text-white">{activeFix.lon.toFixed(7)}°</strong>
                    </div>
                    <div className="flex justify-between text-slate-300">
                      <span className="text-slate-500">Format Sexagésimal :</span>
                      <span className="text-[10px] text-cyan-300 text-right truncate max-w-[200px]">
                        {formatDms(activeFix.lat, activeFix.lon)}
                      </span>
                    </div>
                    <div className="flex justify-between text-slate-300 pt-1">
                      <span className="text-slate-500">Précision horizontale :</span>
                      <span className="text-emerald-400 font-bold">± {activeFix.accuracy.toFixed(2)} m</span>
                    </div>
                    {typeof activeFix.altitude === 'number' && (
                      <div className="flex justify-between text-slate-300">
                        <span className="text-slate-500">Altitude estimée :</span>
                        <span className="text-slate-300">{activeFix.altitude.toFixed(1)} m</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="py-4 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
                    <Radio className="h-4 w-4 animate-spin text-cyan-500" />
                    <span>Synchronisation avec les constellations GNSS...</span>
                  </div>
                )}
              </div>
            )
          )}
        </div>

        {/* Boutons d'action */}
        <div className="pt-3 border-t border-slate-800 flex items-center gap-2">
          {!manualMode && activeFix && (
            <button
              onClick={resetSamples}
              className="flex h-11 px-3 items-center justify-center rounded-xl border border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs"
              title="Réinitialiser l'accumulation"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          )}

          <button
            onClick={handleConfirm}
            disabled={manualMode ? parseDecimal(manualLat) === null || parseDecimal(manualLon) === null : !activeFix}
            className="flex-1 flex h-11 items-center justify-center gap-2 rounded-xl bg-cyan-600 text-xs font-bold text-white shadow-lg shadow-cyan-900/40 hover:bg-cyan-500 active:scale-[0.98] transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Check className="h-4 w-4" />
            <span>Enregistrer cette Borne</span>
          </button>
        </div>
      </div>
    </div>
  );
};
