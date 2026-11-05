/**
 * Application Environment and Remote Services Configuration
 *
 * Provides a standardized configuration layer preventing hardcoded endpoints across the frontend.
 * Supports environment variable overrides and runtime configuration changes.
 */

export interface AppConfig {
  readonly apiBaseUrl: string;
  readonly requestTimeoutMs: number;
  readonly uploadTimeoutMs: number;
}

// Fallback default backend URL deployed on Vercel
const DEFAULT_API_BASE_URL = 'https://backend-five-omega-74.vercel.app';

// In-memory runtime override if changed dynamically during session
let runtimeApiBaseUrl: string | null = null;
const configListeners = new Set<(config: AppConfig) => void>();

/**
 * Validates whether a given URL is a valid backend endpoint.
 */
export function isValidBackendUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  // Accepts standard https URLs as well as http for local development / android emulator
  return /^https?:\/\/[^/\s]+(?:\/[^\s]*)?$/.test(trimmed);
}

/**
 * Returns the currently active API Base URL.
 * Checks runtime override, then process.env (if provided by bundler/env), then default.
 */
export function getApiBaseUrl(): string {
  if (runtimeApiBaseUrl) {
    return runtimeApiBaseUrl;
  }
  const envUrl = typeof process !== 'undefined' && process.env ? process.env.API_BASE_URL : undefined;
  if (envUrl && isValidBackendUrl(envUrl)) {
    return envUrl.trim().replace(/\/+$/, '');
  }
  return DEFAULT_API_BASE_URL.replace(/\/+$/, '');
}

/**
 * Dynamically updates the API Base URL at runtime (e.g., from Settings or debug menu).
 */
export function setApiBaseUrl(url: string): void {
  const normalized = url.trim().replace(/\/+$/, '');
  if (!isValidBackendUrl(normalized)) {
    throw new Error('Please enter a valid HTTP/HTTPS URL.');
  }
  runtimeApiBaseUrl = normalized;
  notifyConfigChange();
}

/**
 * Resets the runtime URL back to the default/environment configuration.
 */
export function resetApiBaseUrl(): void {
  runtimeApiBaseUrl = null;
  notifyConfigChange();
}

/**
 * Subscribes a callback to configuration updates.
 */
export function onConfigChange(listener: (config: AppConfig) => void): () => void {
  configListeners.add(listener);
  return () => {
    configListeners.delete(listener);
  };
}

function notifyConfigChange(): void {
  const current = getAppConfig();
  for (const listener of configListeners) {
    try {
      listener(current);
    } catch {
      // Ignore listener errors
    }
  }
}

/**
 * Returns the active application configuration snapshot.
 */
export function getAppConfig(): AppConfig {
  return {
    apiBaseUrl: getApiBaseUrl(),
    requestTimeoutMs: 30000,
    uploadTimeoutMs: 120000,
  };
}

export const ENV = {
  get API_BASE_URL(): string {
    return getApiBaseUrl();
  },
  REQUEST_TIMEOUT_MS: 30000,
  UPLOAD_TIMEOUT_MS: 120000,
  DEFAULT_API_BASE_URL,
};

