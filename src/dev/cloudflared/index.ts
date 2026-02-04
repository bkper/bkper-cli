/**
 * Cloudflared tunnel management for local development.
 *
 * This module provides a programmatic interface to cloudflared Quick Tunnels,
 * with lazy binary download on first use.
 */

export { bin, DEFAULT_CLOUDFLARED_BIN, BKPER_BIN_DIR } from './constants.js';
export { install, UnsupportedPlatformError } from './install.js';
export { Tunnel } from './tunnel.js';
export type { Connection, TunnelEvents } from './tunnel.js';
