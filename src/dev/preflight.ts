import fs from "fs";
import path from "path";

interface PreflightResult {
    ok: boolean;
    message?: string;
}

function getClientDependencyName(clientRoot: string): string | undefined {
    const pkgPath = path.join(clientRoot, "package.json");
    if (!fs.existsSync(pkgPath)) return undefined;

    try {
        const content = fs.readFileSync(pkgPath, "utf8");
        const pkg = JSON.parse(content) as {
            dependencies?: Record<string, string>;
            devDependencies?: Record<string, string>;
        };

        const deps = pkg.dependencies || {};
        const devDeps = pkg.devDependencies || {};
        const depNames = Object.keys(deps).concat(Object.keys(devDeps));

        if (depNames.includes("lit")) return "lit";
        return depNames[0];
    } catch {
        return undefined;
    }
}

function isDependencyInstalled(projectRoot: string, depName: string): boolean {
    const depPath = path.join(projectRoot, "node_modules", depName, "package.json");
    return fs.existsSync(depPath);
}

function hasSharedPackage(projectRoot: string): boolean {
    return fs.existsSync(path.join(projectRoot, "packages/shared"));
}

export function preflightDependencies(
    projectRoot: string,
    clientRoot?: string,
): PreflightResult {
    const rootPkgPath = path.join(projectRoot, "package.json");
    if (!fs.existsSync(rootPkgPath)) {
        return {
            ok: false,
            message:
                "Missing dependencies. Run bun install at the app root (no package.json found).",
        };
    }

    const nodeModulesPath = path.join(projectRoot, "node_modules");
    if (!fs.existsSync(nodeModulesPath)) {
        return {
            ok: false,
            message:
                "Missing dependencies. Run bun install at the app root (node_modules not found).",
        };
    }

    // Check for TypeScript if shared package exists
    if (hasSharedPackage(projectRoot) && !isDependencyInstalled(projectRoot, "typescript")) {
        return {
            ok: false,
            message:
                "Missing TypeScript. Run bun install at the app root (required for shared package build).",
        };
    }

    if (clientRoot) {
        const depName = getClientDependencyName(clientRoot);
        if (depName && !isDependencyInstalled(projectRoot, depName)) {
            return {
                ok: false,
                message:
                    `Missing client dependencies. Run bun install at the app root (cannot resolve ${depName}).`,
            };
        }
    }

    return { ok: true };
}
