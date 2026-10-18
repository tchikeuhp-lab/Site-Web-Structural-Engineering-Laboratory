import { describe, expect, it } from 'vitest';
import { classifyNativeError } from '../gnss';

describe('classifyNativeError', () => {
  it('reconnaît un refus de permission', () => {
    expect(classifyNativeError(new Error('User denied Geolocation')).kind).toBe('denied');
    expect(classifyNativeError('Location permission was denied').kind).toBe('denied');
  });
  it('reconnaît un délai dépassé', () => {
    expect(classifyNativeError(new Error('Timeout expired')).kind).toBe('timeout');
  });
  it('reconnaît une localisation désactivée', () => {
    expect(classifyNativeError(new Error('Location services are not enabled')).kind).toBe('unavailable');
  });
  it('retombe sur « other » sinon', () => {
    expect(classifyNativeError({ message: 'boom' }).kind).toBe('other');
  });
});
