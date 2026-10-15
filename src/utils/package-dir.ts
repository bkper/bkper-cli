import {existsSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

/** The nearest directory at or above `startDir` that holds a package.json. */
export function findPackageDir(startDir: string): string {
    let dir = startDir;
    while (dir !== path.dirname(dir)) {
        if (existsSync(path.join(dir, 'package.json'))) {
            return dir;
        }
        dir = path.dirname(dir);
    }
    return startDir;
}

/**
 * Root of the running bkper package. Found by walking up, so it holds from `src/` under ts-node,
 * from `lib/` after tsc, and from the agent bundle in `lib/agent/bundle/`.
 */
export const BKPER_PACKAGE_DIR: string = findPackageDir(
    path.dirname(fileURLToPath(import.meta.url))
);

/** Root of the installed `@earendil-works/pi-coding-agent` package. */
export function getPiPackageDir(): string {
    return findPackageDir(
        path.dirname(fileURLToPath(import.meta.resolve('@earendil-works/pi-coding-agent')))
    );
}

/**
 * Bundled into the agent, Pi would look for its package.json, themes, and docs above the bundle and
 * find bkper's instead. PI_PACKAGE_DIR points it back at its installed package; a user value wins.
 */
export function applyPiPackageDir(env: NodeJS.ProcessEnv = process.env): void {
    env.PI_PACKAGE_DIR ??= getPiPackageDir();
}
