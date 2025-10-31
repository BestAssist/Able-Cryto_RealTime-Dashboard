import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WS_URL, API_ORIGIN } from '../api';

describe('API Configuration', () => {
  let originalEnv: typeof import.meta.env;

  beforeEach(() => {
    originalEnv = { ...import.meta.env };
  });

  it('should use default WS_URL when env variable is not set', () => {
    expect(WS_URL).toBe('ws://localhost:3000');
  });

  it('should use default API_ORIGIN when env variable is not set', () => {
    expect(API_ORIGIN).toBe('http://localhost:3000');
  });

  it('should export WS_URL constant', () => {
    expect(typeof WS_URL).toBe('string');
    expect(WS_URL.length).toBeGreaterThan(0);
  });

  it('should export API_ORIGIN constant', () => {
    expect(typeof API_ORIGIN).toBe('string');
    expect(API_ORIGIN.length).toBeGreaterThan(0);
  });
});

