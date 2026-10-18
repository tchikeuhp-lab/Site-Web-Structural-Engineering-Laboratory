/**
 * Accès GNSS unifié : plugin natif Capacitor sur Android, API navigateur ailleurs.
 * Les deux chemins renvoient les mêmes structures normalisées.
 */
import { Geolocation } from '@capacitor/geolocation';
import type { GpsSample } from '../types/survey';
import { isNative } from './platform';

export type GnssPermission = 'prompt' | 'granted' | 'denied' | 'unknown';
export type GnssErrorKind = 'denied' | 'unavailable' | 'timeout' | 'other';
export interface GnssError {
  kind: GnssErrorKind;
  message: string;
}
export interface GnssOptions {
  enableHighAccuracy: boolean;
  timeout: number;
  maximumAge: number;
}

export function gnssSupported(): boolean {
  return isNative() || (typeof navigator !== 'undefined' && !!navigator.geolocation);
}

export function classifyNativeError(err: unknown): GnssError {
  const message = err instanceof Error ? err.message : typeof err === 'string' ? err : String((err as { message?: unknown })?.message ?? '');
  let kind: GnssErrorKind = 'other';
  if (/denied|permission|not authori[sz]ed|refus/i.test(message)) kind = 'denied';
  else if (/time ?out|timed out/i.test(message)) kind = 'timeout';
  else if (/disabled|unavailable|not available|location services/i.test(message)) kind = 'unavailable';
  return { kind, message };
}

function fromBrowserError(err: GeolocationPositionError): GnssError {
  const kind: GnssErrorKind =
    err.code === err.PERMISSION_DENIED ? 'denied' : err.code === err.POSITION_UNAVAILABLE ? 'unavailable' : err.code === err.TIMEOUT ? 'timeout' : 'other';
  return { kind, message: err.message };
}

function fromPosition(pos: { coords: { latitude: number; longitude: number; accuracy: number; altitude: number | null }; timestamp: number }): GpsSample {
  return {
    lat: pos.coords.latitude,
    lon: pos.coords.longitude,
    accuracy: pos.coords.accuracy,
    altitude: pos.coords.altitude ?? null,
    timestamp: pos.timestamp,
  };
}

function mapState(state: string | undefined): GnssPermission {
  if (state === 'granted') return 'granted';
  if (state === 'denied') return 'denied';
  if (state === 'prompt' || state === 'prompt-with-rationale') return 'prompt';
  return 'unknown';
}

/** État actuel de la permission, sans rien demander à l'utilisateur. */
export async function gnssCheckPermission(): Promise<GnssPermission> {
  if (isNative()) {
    try {
      const res = await Geolocation.checkPermissions();
      return mapState(res.location === 'granted' || res.coarseLocation === 'granted' ? 'granted' : res.location);
    } catch {
      return 'unknown';
    }
  }
  return 'unknown';
}

/** Demande la permission (Android : boîte de dialogue système). Sans effet dans un navigateur. */
export async function gnssRequestPermission(): Promise<GnssPermission> {
  if (!isNative()) return 'unknown';
  try {
    const res = await Geolocation.requestPermissions({ permissions: ['location'] });
    return mapState(res.location === 'granted' || res.coarseLocation === 'granted' ? 'granted' : res.location);
  } catch (err) {
    return classifyNativeError(err).kind === 'denied' ? 'denied' : 'unknown';
  }
}

export function gnssGetCurrent(opts: GnssOptions): Promise<GpsSample> {
  if (isNative()) {
    return Geolocation.getCurrentPosition(opts).then(fromPosition, (err) => Promise.reject(classifyNativeError(err)));
  }
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition((p) => resolve(fromPosition(p)), (e) => reject(fromBrowserError(e)), opts);
  });
}

/** Surveillance continue ; renvoie la fonction d'arrêt. */
export async function gnssWatch(opts: GnssOptions, onPosition: (s: GpsSample) => void, onError: (e: GnssError) => void): Promise<() => void> {
  if (isNative()) {
    const id = await Geolocation.watchPosition(opts, (pos, err) => {
      if (err) onError(classifyNativeError(err));
      else if (pos) onPosition(fromPosition(pos));
    });
    return () => {
      void Geolocation.clearWatch({ id });
    };
  }
  const id = navigator.geolocation.watchPosition((p) => onPosition(fromPosition(p)), (e) => onError(fromBrowserError(e)), opts);
  return () => navigator.geolocation.clearWatch(id);
}
