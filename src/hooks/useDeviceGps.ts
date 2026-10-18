import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { GpsSample } from '../types/survey';
import { processGpsSamples } from '../utils/satelliteEngine';

export type GpsPermissionState = 'prompt' | 'granted' | 'denied' | 'unknown';

export function useDeviceGps() {
  const [isSupported, setIsSupported] = useState(true);
  const [isTracking, setIsTracking] = useState(false);
  const [isAcquiring, setIsAcquiring] = useState(false);
  const [currentFix, setCurrentFix] = useState<GpsSample | null>(null);
  const [samples, setSamples] = useState<GpsSample[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [permissionState, setPermissionState] = useState<GpsPermissionState>('unknown');
  const [isSimulated, setIsSimulated] = useState(false);

  const watchIdRef = useRef<number | null>(null);
  const simulationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Vérification de la disponibilité et de l'état de la permission via l'API Permissions
  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setIsSupported(false);
      setError('La géolocalisation GPS n’est pas supportée par cet appareil ou ce navigateur.');
      return;
    }

    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions
        .query({ name: 'geolocation' })
        .then((result) => {
          setPermissionState(result.state as GpsPermissionState);
          result.onchange = () => {
            setPermissionState(result.state as GpsPermissionState);
            if (result.state === 'granted') {
              setError(null);
            }
          };
        })
        .catch(() => {
          setPermissionState('unknown');
        });
    }
  }, []);

  const handlePosition = useCallback((pos: GeolocationPosition) => {
    const newSample: GpsSample = {
      lat: pos.coords.latitude,
      lon: pos.coords.longitude,
      accuracy: pos.coords.accuracy,
      altitude: pos.coords.altitude,
      timestamp: pos.timestamp,
    };

    setCurrentFix(newSample);
    setError(null);
    setPermissionState('granted');
    setIsAcquiring(false);
    setIsSimulated(false);

    setSamples((prev) => {
      const updated = [...prev, newSample];
      if (updated.length > 30) {
        return updated.slice(updated.length - 30);
      }
      return updated;
    });
  }, []);

  const handleError = useCallback((err: GeolocationPositionError) => {
    setIsAcquiring(false);
    switch (err.code) {
      case err.PERMISSION_DENIED:
        setPermissionState('denied');
        setError(
          'Accès au capteur GPS bloqué par le navigateur. Veuillez autoriser la localisation pour cette page.'
        );
        break;
      case err.POSITION_UNAVAILABLE:
        setError('Signal satellite temporairement indisponible. Placez-vous sous un ciel dégagé.');
        break;
      case err.TIMEOUT:
        setError('Délai d’attente satellite dépassé. Recherche active en cours...');
        break;
      default:
        setError(err.message || 'Erreur du capteur GPS.');
    }
  }, []);

  // Démarre la surveillance continue
  const startTracking = useCallback(() => {
    if (!navigator.geolocation) return;
    if (watchIdRef.current !== null) return;

    setError(null);
    setIsTracking(true);

    const options: PositionOptions = {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 1000,
    };

    try {
      watchIdRef.current = navigator.geolocation.watchPosition(
        handlePosition,
        handleError,
        options
      );
    } catch {
      setError('Impossible d’initialiser le capteur GNSS.');
      setIsTracking(false);
    }
  }, [handlePosition, handleError]);

  // Déclenchement explicite sur geste utilisateur (User Activation Gesture)
  const requestPermissionAndStart = useCallback(async (): Promise<boolean> => {
    if (!navigator.geolocation) {
      setError('Géolocalisation non supportée.');
      return false;
    }

    setIsAcquiring(true);
    setError(null);

    return new Promise((resolve) => {
      // Niveau 1 : Tentative haute précision GNSS
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          handlePosition(pos);
          startTracking();
          resolve(true);
        },
        (err) => {
          if (err.code === err.PERMISSION_DENIED) {
            handleError(err);
            resolve(false);
            return;
          }

          // Niveau 2 : Repli avec précision standard si le GPS pur tarde
          navigator.geolocation.getCurrentPosition(
            (fallbackPos) => {
              handlePosition(fallbackPos);
              startTracking();
              resolve(true);
            },
            (finalErr) => {
              handleError(finalErr);
              resolve(false);
            },
            { enableHighAccuracy: false, timeout: 10000, maximumAge: 5000 }
          );
        },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 2000 }
      );
    });
  }, [handlePosition, handleError, startTracking]);

  // Simulation GNSS pour environnement de test ou zone sans capteur GPS
  const startSimulation = useCallback((centerLat = 3.848, centerLon = 11.5021) => {
    if (simulationIntervalRef.current) {
      clearInterval(simulationIntervalRef.current);
    }

    setError(null);
    setIsAcquiring(false);
    setIsTracking(true);
    setIsSimulated(true);

    let count = 0;
    simulationIntervalRef.current = setInterval(() => {
      count++;
      // Dérive aléatoire réaliste de satellite (bruit de 0.5 à 2 mètres)
      const latNoise = (Math.random() - 0.5) * 0.00002;
      const lonNoise = (Math.random() - 0.5) * 0.00003;
      const accuracy = 1.2 + Math.random() * 1.5;

      const simSample: GpsSample = {
        lat: Number((centerLat + latNoise).toFixed(7)),
        lon: Number((centerLon + lonNoise).toFixed(7)),
        accuracy: Number(accuracy.toFixed(2)),
        altitude: 142.5 + (Math.random() - 0.5) * 0.8,
        timestamp: Date.now(),
      };

      setCurrentFix(simSample);
      setSamples((prev) => {
        const next = [...prev, simSample];
        return next.length > 30 ? next.slice(next.length - 30) : next;
      });

      if (count >= 20 && simulationIntervalRef.current) {
        clearInterval(simulationIntervalRef.current);
        simulationIntervalRef.current = null;
      }
    }, 400); // 1 échantillon toutes les 400ms
  }, []);

  const stopTracking = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (simulationIntervalRef.current) {
      clearInterval(simulationIntervalRef.current);
      simulationIntervalRef.current = null;
    }
    setIsTracking(false);
    setIsAcquiring(false);
  }, []);

  const resetSamples = useCallback(() => {
    setSamples([]);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Nettoyage au démontage
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      if (simulationIntervalRef.current) {
        clearInterval(simulationIntervalRef.current);
      }
    };
  }, []);

  // Calcul stabilisé via l'algorithme GNSS multi-satellites
  const stabilizedFix = useMemo(
    () => (samples.length > 0 ? processGpsSamples(samples) : null),
    [samples]
  );

  return {
    isSupported,
    isTracking,
    isAcquiring,
    isSimulated,
    permissionState,
    currentFix,
    stabilizedFix,
    samples,
    sampleCount: samples.length,
    error,
    startTracking,
    stopTracking,
    requestPermissionAndStart,
    startSimulation,
    resetSamples,
    clearError,
  };
}
