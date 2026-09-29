import { execSync } from 'child_process';
import { accessSync, constants, existsSync, readFileSync, realpathSync } from 'fs';
import { createRequire } from 'module';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const pkg = require('../../package.json');

/** Current installed version of the CLI. */
export const VERSION: string = pkg.version;

/** Package name on npm. */
const PACKAGE_NAME = 'bkper';

/** Directory of the running bkper package (the folder holding its package.json). */
export const PACKAGE_DIR: string = fileURLToPath(new URL('../../', import.meta.url)).replace(
    /[\\/]$/,
    ''
);

/** Supported installation methods. */
export type InstallMethod = 'npm' | 'pnpm' | 'yarn' | 'bun' | 'unknown';

/** Where the running CLI lives and how it was started. */
export interface RuntimeLocation {
    packageDir: string;
    /** process.argv[1], not symlink-resolved. */
    entrypoint?: string;
    execPath: string;
    isBunRuntime: boolean;
    platform: NodeJS.Platform;
}

/** Side effects needed to decide whether the running copy can upgrade itself. */
export interface SelfUpdateEnvironment {
    homedir: string;
    readCommandOutput: (command: string) => string | undefined;
    isWritable: (dir: string) => boolean;
}

export interface InstallPlan {
    kind: 'install';
    method: InstallMethod;
    packageDir: string;
    command: string;
    /** package.json to read after installing, reached through the global root. */
    packageJsonPath: string;
}

export interface ManualPlan {
    kind: 'manual';
    method: InstallMethod;
    packageDir: string;
    instruction: string;
}

export type SelfUpdatePlan = InstallPlan | ManualPlan;

export function getRuntimeLocation(): RuntimeLocation {
    return {
        packageDir: PACKAGE_DIR,
        entrypoint: process.argv[1],
        execPath: process.execPath,
        isBunRuntime: !!process.versions.bun,
        platform: process.platform,
    };
}

function readCommandOutput(command: string): string | undefined {
    try {
        const output = execSync(command, {
            encoding: 'utf-8',
            timeout: 10000,
            stdio: ['ignore', 'pipe', 'ignore'],
            windowsHide: true,
        }).trim();
        return output || undefined;
    } catch {
        return undefined;
    }
}

function isWritable(dir: string): boolean {
    try {
        accessSync(dir, constants.W_OK);
        return true;
    } catch {
        return false;
    }
}

function getDefaultSelfUpdateEnvironment(): SelfUpdateEnvironment {
    return { homedir: os.homedir(), readCommandOutput, isWritable };
}

function pathApi(platform: NodeJS.Platform): path.PlatformPath {
    return platform === 'win32' ? path.win32 : path.posix;
}

/**
 * Detects the package manager from the location of the running code
 * (same rules as Pi's detectInstallMethod).
 */
export function detectInstallMethod(location: RuntimeLocation = getRuntimeLocation()): InstallMethod {
    const resolved = `${location.packageDir}/\0${location.execPath}`
        .toLowerCase()
        .replace(/\\/g, '/');

    if (resolved.includes('/pnpm/') || resolved.includes('/.pnpm/')) {
        return 'pnpm';
    }
    if (resolved.includes('/yarn/') || resolved.includes('/.yarn/')) {
        return 'yarn';
    }
    if (location.isBunRuntime || resolved.includes('/install/global/node_modules/')) {
        return 'bun';
    }
    if (resolved.includes('/npm/') || resolved.includes('/node_modules/')) {
        return 'npm';
    }
    return 'unknown';
}

/**
 * Infers the npm prefix from a `<prefix>/lib/node_modules/bkper` layout.
 * Windows prefixes look like project installs, so they are never inferred.
 */
export function inferNpmPrefix(packageDir: string, platform: NodeJS.Platform): string | undefined {
    if (platform === 'win32') {
        return undefined;
    }
    const p = pathApi(platform);
    const root = p.dirname(packageDir);
    if (p.basename(root) !== 'node_modules') {
        return undefined;
    }
    const lib = p.dirname(root);
    return p.basename(lib) === 'lib' ? p.dirname(lib) : undefined;
}

/**
 * Returns the shell command that installs a version with a package manager.
 */
export function getInstallCommand(
    method: InstallMethod,
    version: string,
    npmPrefix?: string
): string | null {
    const spec = `${PACKAGE_NAME}@${version}`;
    switch (method) {
        case 'npm':
            return npmPrefix
                ? `npm --prefix "${npmPrefix}" install -g ${spec}`
                : `npm install -g ${spec}`;
        case 'pnpm':
            return `pnpm add -g ${spec}`;
        case 'yarn':
            return `yarn global add ${spec}`;
        case 'bun':
            return `bun add -g ${spec}`;
        default:
            return null;
    }
}

function getGlobalRoots(
    method: InstallMethod,
    location: RuntimeLocation,
    environment: SelfUpdateEnvironment
): string[] {
    switch (method) {
        case 'npm': {
            const prefix = inferNpmPrefix(location.packageDir, location.platform);
            const roots = [environment.readCommandOutput('npm root -g')];
            if (prefix) {
                roots.push(path.join(prefix, 'lib', 'node_modules'));
            }
            return roots.filter((root): root is string => !!root);
        }
        case 'pnpm': {
            const root = environment.readCommandOutput('pnpm root -g');
            return root ? [root, path.dirname(root)] : [];
        }
        case 'yarn': {
            const dir = environment.readCommandOutput('yarn global dir');
            return dir ? [dir, path.join(dir, 'node_modules')] : [];
        }
        case 'bun': {
            const roots = [path.join(environment.homedir, '.bun', 'install', 'global', 'node_modules')];
            const bunBin = environment.readCommandOutput('bun pm bin -g');
            if (bunBin) {
                roots.push(path.join(path.dirname(bunBin), 'install', 'global', 'node_modules'));
            }
            return roots;
        }
        default:
            return [];
    }
}

function getComparablePaths(target: string, platform: NodeJS.Platform): string[] {
    const resolved = path.resolve(target);
    if (!existsSync(resolved)) {
        return [];
    }
    const candidates = [resolved];
    try {
        candidates.push(realpathSync(resolved));
    } catch {
        // Keep the unresolved path only
    }
    return [...new Set(candidates.map(c => (platform === 'win32' ? c.toLowerCase() : c)))];
}

function getEntrypointPackageDir(entrypoint: string | undefined): string | undefined {
    if (!entrypoint) {
        return undefined;
    }
    let dir = path.dirname(path.resolve(entrypoint));
    while (dir !== path.dirname(dir)) {
        if (existsSync(path.join(dir, 'package.json'))) {
            return dir;
        }
        dir = path.dirname(dir);
    }
    return undefined;
}

/**
 * Finds the global root holding the running package, if any, and returns
 * the package.json reached through it (not the symlink-resolved store path).
 */
function findManagedPackageJson(roots: string[], location: RuntimeLocation): string | undefined {
    const packageDirs = [location.packageDir, getEntrypointPackageDir(location.entrypoint)]
        .filter((dir): dir is string => !!dir)
        .flatMap(dir => getComparablePaths(dir, location.platform));

    const containingRoots = roots.filter(root =>
        getComparablePaths(root, location.platform).some(normalizedRoot => {
            const prefix = normalizedRoot.endsWith(path.sep)
                ? normalizedRoot
                : `${normalizedRoot}${path.sep}`;
            return packageDirs.some(dir => dir.startsWith(prefix));
        })
    );
    if (containingRoots.length === 0) {
        return undefined;
    }

    for (const root of containingRoots) {
        const packageJsonPath = path.join(root, PACKAGE_NAME, 'package.json');
        if (existsSync(packageJsonPath)) {
            return packageJsonPath;
        }
    }
    return path.join(location.packageDir, 'package.json');
}

/**
 * Decides whether the running copy can safely upgrade itself: it must be
 * inside its package manager's global root and writable. Otherwise returns
 * the manual instruction to show. Never suggests sudo.
 */
export function getSelfUpdatePlan(
    version: string,
    location: RuntimeLocation = getRuntimeLocation(),
    environment: SelfUpdateEnvironment = getDefaultSelfUpdateEnvironment()
): SelfUpdatePlan {
    const method = detectInstallMethod(location);
    const packageDir = location.packageDir;
    const npmPrefix =
        method === 'npm' ? inferNpmPrefix(packageDir, location.platform) : undefined;
    const command = getInstallCommand(method, version, npmPrefix);

    const manual = (instruction: string): ManualPlan => ({
        kind: 'manual',
        method,
        packageDir,
        instruction,
    });

    if (!command) {
        return manual(
            `Update bkper with the package manager, wrapper, or source checkout that provides ${packageDir}.`
        );
    }

    if (location.platform === 'win32' && method !== 'npm' && method !== 'pnpm') {
        return manual(
            `Automatic upgrade on Windows supports only npm and pnpm installs. Run: ${command}`
        );
    }

    const packageJsonPath = findManagedPackageJson(
        getGlobalRoots(method, location, environment),
        location
    );
    if (!packageJsonPath) {
        return manual(
            `bkper at ${packageDir} is not a global ${method} install. ` +
                `Update it with the package manager, wrapper, or source checkout that provides it.`
        );
    }

    if (!environment.isWritable(packageDir) || !environment.isWritable(path.dirname(packageDir))) {
        return manual(
            `The global ${method} install at ${packageDir} is not writable. ` +
                `Update it yourself with: ${command}`
        );
    }

    return { kind: 'install', method, packageDir, command, packageJsonPath };
}

/**
 * Reads a package version from disk, bypassing the module cache.
 */
export function readInstalledVersion(packageJsonPath: string): string | undefined {
    try {
        const data = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as { version?: unknown };
        return typeof data.version === 'string' ? data.version : undefined;
    } catch {
        return undefined;
    }
}

/**
 * Runs an install command synchronously. BKPER_AUTOUPDATE_COMMAND replaces
 * the command (for tests) but never the safety checks that lead here.
 */
export function runInstallCommand(command: string): void {
    const effectiveCommand = process.env.BKPER_AUTOUPDATE_COMMAND || command;
    execSync(effectiveCommand, { stdio: 'pipe', timeout: 120000, windowsHide: true });
}

/**
 * Fetches the latest published version from the npm registry.
 * Returns null if the fetch fails.
 */
export async function fetchLatestVersion(timeoutMs = 5000): Promise<string | null> {
    const latestVersionOverride = process.env.BKPER_AUTOUPDATE_LATEST_VERSION;
    if (latestVersionOverride) {
        return latestVersionOverride;
    }

    try {
        const response = await fetch(`https://registry.npmjs.org/${PACKAGE_NAME}/latest`, {
            headers: { Accept: 'application/json' },
            signal: AbortSignal.timeout(timeoutMs),
        });
        if (!response.ok) return null;
        const data = (await response.json()) as { version?: string };
        return data.version ?? null;
    } catch {
        return null;
    }
}
