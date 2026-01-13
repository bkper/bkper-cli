import { Bkper } from 'bkper-js';
import { getOAuthToken } from '../auth/local-auth-service.js';

let configuredBkperInstance: Bkper | undefined = undefined;

/**
 * Get a configured Bkper instance with authentication setup.
 * Uses singleton pattern to avoid repeated configuration.
 * 
 * @returns Configured Bkper instance
 */
export function getBkperInstance(): Bkper {
  // Return mock instance if in test environment
  if (process.env.NODE_ENV === 'test' || (globalThis as any).__mockBkper) {
    return (globalThis as any).__mockBkper || Bkper;
  }

  // Return cached instance if already configured
  if (configuredBkperInstance) {
    return configuredBkperInstance;
  }

  // Configure Bkper with authentication
  setupBkper();  
  // Cache the configured instance
  configuredBkperInstance = new Bkper();
  
  return configuredBkperInstance;
}

/**
 * Default API proxy URL for clients without their own API key.
 * The proxy injects a managed API key server-side.
 */
const API_PROXY_BASE_URL = 'https://api.bkper.app';

/**
 * Configure Bkper with authentication.
 * 
 * If BKPER_API_KEY is set, uses direct API access (for power users with own quotas).
 * Otherwise, uses the API proxy which injects a managed key server-side.
 */
export function setupBkper() {
  const apiKey = process.env.BKPER_API_KEY;

  Bkper.setConfig({
    // Only provide API key if user has one configured
    apiKeyProvider: apiKey ? async () => apiKey : undefined,
    oauthTokenProvider: () => getOAuthToken(),
    // Use proxy when no API key is configured
    apiBaseUrl: apiKey ? undefined : API_PROXY_BASE_URL
  });
}

