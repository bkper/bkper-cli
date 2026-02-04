import fs from 'fs';
import path from 'path';
import https from 'https';
import { execSync } from 'child_process';
import { RELEASE_BASE, LINUX_BINARIES, MACOS_BINARIES, WINDOWS_BINARIES } from './constants.js';

/**
 * Error thrown when the platform or architecture is not supported.
 */
export class UnsupportedPlatformError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'UnsupportedPlatformError';
    }
}

/**
 * Resolves the base URL for a specific cloudflared version.
 */
function resolveReleaseUrl(version: string): string {
    if (version === 'latest') {
        return `${RELEASE_BASE}latest/download/`;
    }
    return `${RELEASE_BASE}download/${version}/`;
}

/**
 * Downloads a file from a URL to a local path, following redirects.
 */
function download(url: string, to: string, redirectCount = 0): Promise<string> {
    return new Promise((resolve, reject) => {
        if (!fs.existsSync(path.dirname(to))) {
            fs.mkdirSync(path.dirname(to), { recursive: true });
        }

        const request = https.get(url, res => {
            const redirectCodes = [301, 302, 303, 307, 308];
            if (redirectCodes.includes(res.statusCode ?? 0) && res.headers.location) {
                request.destroy();
                resolve(download(res.headers.location, to, redirectCount + 1));
                return;
            }

            if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
                const file = fs.createWriteStream(to);

                file.on('finish', () => {
                    file.close(() => resolve(to));
                });

                file.on('error', err => {
                    fs.unlink(to, () => reject(err));
                });

                res.pipe(file);
            } else {
                request.destroy();
                reject(new Error(`HTTP request failed with status code: ${res.statusCode}`));
            }
        });

        request.on('error', err => {
            reject(err);
        });

        request.end();
    });
}

/**
 * Installs cloudflared for Linux.
 */
async function installLinux(to: string, version: string): Promise<string> {
    const file = LINUX_BINARIES[process.arch];

    if (!file) {
        throw new UnsupportedPlatformError(`Unsupported Linux architecture: ${process.arch}`);
    }

    await download(resolveReleaseUrl(version) + file, to);
    fs.chmodSync(to, '755');
    return to;
}

/**
 * Installs cloudflared for macOS.
 */
async function installMacOS(to: string, version: string): Promise<string> {
    const file = MACOS_BINARIES[process.arch];

    if (!file) {
        throw new UnsupportedPlatformError(`Unsupported macOS architecture: ${process.arch}`);
    }

    const tgzPath = `${to}.tgz`;
    await download(resolveReleaseUrl(version) + file, tgzPath);

    // Extract the tarball
    execSync(`tar -xzf ${path.basename(tgzPath)}`, { cwd: path.dirname(to) });
    fs.unlinkSync(tgzPath);

    // The extracted binary is named 'cloudflared'
    const extractedPath = path.join(path.dirname(to), 'cloudflared');
    if (extractedPath !== to) {
        fs.renameSync(extractedPath, to);
    }

    return to;
}

/**
 * Installs cloudflared for Windows.
 */
async function installWindows(to: string, version: string): Promise<string> {
    const file = WINDOWS_BINARIES[process.arch];

    if (!file) {
        throw new UnsupportedPlatformError(`Unsupported Windows architecture: ${process.arch}`);
    }

    await download(resolveReleaseUrl(version) + file, to);
    return to;
}

/**
 * Installs the cloudflared binary to the specified path.
 *
 * @param to - The path where the binary should be installed.
 * @param version - The version to install. Defaults to 'latest'.
 * @returns The path to the installed binary.
 */
export async function install(to: string, version = 'latest'): Promise<string> {
    switch (process.platform) {
        case 'linux':
            return installLinux(to, version);
        case 'darwin':
            return installMacOS(to, version);
        case 'win32':
            return installWindows(to, version);
        default:
            throw new UnsupportedPlatformError(`Unsupported platform: ${process.platform}`);
    }
}
