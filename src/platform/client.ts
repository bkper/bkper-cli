/**
 * Bkper Platform API Client
 *
 * Typed client for interacting with the Bkper Platform API.
 * Types are generated from the OpenAPI spec.
 *
 * @example
 * ```ts
 * import { createPlatformClient } from './platform/client.js';
 *
 * const client = createPlatformClient(token);
 *
 * // Deploy an app
 * const { data, error } = await client.POST('/api/apps/{appId}/deploy', {
 *   params: { path: { appId: 'my-app' }, query: { env: 'dev', type: 'web' } },
 *   body: bundleBuffer,
 * });
 * ```
 */

import createClient from 'openapi-fetch';
import type { paths } from './types.js';

const PLATFORM_API_URL =
  process.env.BKPER_PLATFORM_URL || 'https://platform.bkper.app';

/**
 * Creates a typed Platform API client.
 *
 * @param token - OAuth bearer token
 * @param baseUrl - Optional base URL override (for local development)
 * @returns Typed openapi-fetch client
 */
export function createPlatformClient(token: string, baseUrl = PLATFORM_API_URL) {
  return createClient<paths>({
    baseUrl,
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

/**
 * Type alias for the Platform API client
 */
export type PlatformClient = ReturnType<typeof createPlatformClient>;

/**
 * Re-export types for convenience
 */
export type { paths, components } from './types.js';
