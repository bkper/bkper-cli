import path from 'path';
import os from 'os';

/**
 * Directory where bkper stores configuration and binaries.
 * Uses ~/.config/bkper on Unix-like systems.
 */
export const BKPER_CONFIG_DIR = path.join(os.homedir(), '.config', 'bkper');

/**
 * Directory for bkper-managed binaries.
 */
export const BKPER_BIN_DIR = path.join(BKPER_CONFIG_DIR, 'bin');

/**
 * Default path to the cloudflared binary.
 */
export const DEFAULT_CLOUDFLARED_BIN = path.join(
    BKPER_BIN_DIR,
    process.platform === 'win32' ? 'cloudflared.exe' : 'cloudflared'
);

/**
 * Path to the cloudflared binary.
 * Can be overridden with CLOUDFLARED_BIN environment variable.
 */
export const bin = process.env.CLOUDFLARED_BIN || DEFAULT_CLOUDFLARED_BIN;

/**
 * Base URL for cloudflared releases on GitHub.
 */
export const RELEASE_BASE = 'https://github.com/cloudflare/cloudflared/releases/';

/**
 * Download URLs for Linux by architecture.
 */
export const LINUX_BINARIES: Partial<Record<string, string>> = {
    arm64: 'cloudflared-linux-arm64',
    arm: 'cloudflared-linux-arm',
    x64: 'cloudflared-linux-amd64',
    ia32: 'cloudflared-linux-386',
};

/**
 * Download URLs for macOS by architecture.
 */
export const MACOS_BINARIES: Partial<Record<string, string>> = {
    arm64: 'cloudflared-darwin-arm64.tgz',
    x64: 'cloudflared-darwin-amd64.tgz',
};

/**
 * Download URLs for Windows by architecture.
 */
export const WINDOWS_BINARIES: Partial<Record<string, string>> = {
    x64: 'cloudflared-windows-amd64.exe',
    ia32: 'cloudflared-windows-386.exe',
};
