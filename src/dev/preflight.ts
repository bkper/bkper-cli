import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';

interface PreflightResult {
    ok: boolean;
    message?: string;
}

interface PreflightOptions {
    requireMiniflare?: boolean;
}

type PackageManifest = {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
};

function isDependencyInstalled(projectRoot: string, depName: string): boolean {
    const depPath = path.join(projectRoot, 'node_modules', depName, 'package.json');
    return fs.existsSync(depPath);
}

function isDependencyResolvable(projectRoot: string, depName: string): boolean {
    const require = createRequire(import.meta.url);

    try {
        require.resolve(depName, { paths: [projectRoot] });
        return true;
    } catch {
        return false;
    }
}

function readPackageManifest(projectRoot: string): PackageManifest | undefined {
    const packageJsonPath = path.join(projectRoot, 'package.json');

    try {
        return JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')) as PackageManifest;
    } catch {
        return undefined;
    }
}

function isDeclaredDependency(projectRoot: string, depName: string): boolean {
    const pkg = readPackageManifest(projectRoot);
    return !!pkg?.dependencies?.[depName] || !!pkg?.devDependencies?.[depName];
}

function hasSharedPackage(projectRoot: string): boolean {
    return fs.existsSync(path.join(projectRoot, 'packages/shared'));
}

/**
 * Pre-flight dependency checks for dev and build commands.
 * Verifies: package.json exists, node_modules installed, TypeScript for shared package,
 * and optionally app-local Miniflare for local worker development.
 *
 * Client framework checks are the template's concern — handled by Vite/npm install.
 */
export function preflightDependencies(
    projectRoot: string,
    options: PreflightOptions = {}
): PreflightResult {
    const rootPkgPath = path.join(projectRoot, 'package.json');
    if (!fs.existsSync(rootPkgPath)) {
        return {
            ok: false,
            message:
                'Missing dependencies. Install dependencies at the app root (no package.json found).',
        };
    }

    const nodeModulesPath = path.join(projectRoot, 'node_modules');
    if (!fs.existsSync(nodeModulesPath)) {
        return {
            ok: false,
            message:
                'Missing dependencies. Install dependencies at the app root (node_modules not found).',
        };
    }

    // Check for TypeScript if shared package exists
    if (hasSharedPackage(projectRoot) && !isDependencyInstalled(projectRoot, 'typescript')) {
        return {
            ok: false,
            message:
                'Missing TypeScript. Install dependencies at the app root (required for shared package build).',
        };
    }

    if (options.requireMiniflare) {
        if (!isDeclaredDependency(projectRoot, 'miniflare')) {
            return {
                ok: false,
                message:
                    'Missing Miniflare. Install it in the app root devDependencies (e.g. bun add -d miniflare or npm install -D miniflare).',
            };
        }

        if (!isDependencyResolvable(projectRoot, 'miniflare')) {
            return {
                ok: false,
                message:
                    'Miniflare is declared but not installed. Run install at the app root and try again.',
            };
        }
    }

    return { ok: true };
}
