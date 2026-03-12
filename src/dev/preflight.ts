import fs from 'fs';
import path from 'path';

interface PreflightResult {
    ok: boolean;
    message?: string;
}

function isDependencyInstalled(projectRoot: string, depName: string): boolean {
    const depPath = path.join(projectRoot, 'node_modules', depName, 'package.json');
    return fs.existsSync(depPath);
}

function hasSharedPackage(projectRoot: string): boolean {
    return fs.existsSync(path.join(projectRoot, 'packages/shared'));
}

/**
 * Pre-flight dependency checks for dev and build commands.
 * Verifies: package.json exists, node_modules installed, TypeScript for shared package.
 *
 * Client framework checks are the template's concern — handled by Vite/npm install.
 */
export function preflightDependencies(projectRoot: string): PreflightResult {
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

    return { ok: true };
}
