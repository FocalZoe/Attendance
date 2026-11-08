import { describe, expect, it } from 'vitest';
import { mapPermissionState, shouldAutoStartCamera } from './camera-permission';

describe('mapPermissionState', () => {
  it('passes through known browser states', () => {
    expect(mapPermissionState('granted')).toBe('granted');
    expect(mapPermissionState('denied')).toBe('denied');
    expect(mapPermissionState('prompt')).toBe('prompt');
  });

  it('returns unknown when the Permissions API is unavailable', () => {
    expect(mapPermissionState(undefined)).toBe('unknown');
    expect(mapPermissionState(null)).toBe('unknown');
  });
});

describe('shouldAutoStartCamera', () => {
  it('starts automatically only with permission and a local camera', () => {
    expect(shouldAutoStartCamera('granted', false)).toBe(true);
    expect(shouldAutoStartCamera('granted', true)).toBe(false);
    expect(shouldAutoStartCamera('prompt', false)).toBe(false);
    expect(shouldAutoStartCamera('denied', false)).toBe(false);
    expect(shouldAutoStartCamera('unknown', false)).toBe(false);
  });
});
