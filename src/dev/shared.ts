import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';

export interface SharedBuildResult {
    built: boolean;
    success: boolean;
    diagnostics?: string[];
}

/**
 * Dynamically loads TypeScript from the project's node_modules.
 * Returns undefined if TypeScript is not installed in the project.
 */
async function loadProjectTypeScript(
    projectRoot: string
): Promise<typeof import('typescript') | undefined> {
    const require = createRequire(import.meta.url);
    const tsPath = path.join(projectRoot, 'node_modules', 'typescript');

    if (!fs.existsSync(tsPath)) {
        return undefined;
    }

    try {
        // Resolve the actual TypeScript module from the project
        const resolvedPath = require.resolve('typescript', { paths: [projectRoot] });
        const ts = await import(resolvedPath);
        return ts.default || ts;
    } catch {
        return undefined;
    }
}

function formatDiagnostic(
    ts: typeof import('typescript'),
    diagnostic: import('typescript').Diagnostic
): string {
    const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, ' ');
    if (diagnostic.file && diagnostic.start !== undefined) {
        const { line, character } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
        const filePath = diagnostic.file.fileName;
        return `${filePath}:${line + 1}:${character + 1} - ${message}`;
    }
    return message;
}

function findConfigFile(ts: typeof import('typescript'), searchPath: string): string | undefined {
    const configPath = ts.findConfigFile(searchPath, ts.sys.fileExists, 'tsconfig.json');
    return configPath ?? undefined;
}

export async function buildSharedIfPresent(projectRoot: string): Promise<SharedBuildResult> {
    const sharedRoot = path.join(projectRoot, 'packages/shared');
    if (!fs.existsSync(sharedRoot)) {
        return { built: false, success: true };
    }

    // Load TypeScript from the project's node_modules
    const ts = await loadProjectTypeScript(projectRoot);
    if (!ts) {
        return {
            built: false,
            success: false,
            diagnostics: [
                'TypeScript not found. Run bun install at the app root (required for shared package build).',
            ],
        };
    }

    const configPath = findConfigFile(ts, sharedRoot);
    if (!configPath) {
        return {
            built: false,
            success: false,
            diagnostics: ['tsconfig.json not found in packages/shared'],
        };
    }

    const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
    if (configFile.error) {
        return {
            built: true,
            success: false,
            diagnostics: [formatDiagnostic(ts, configFile.error)],
        };
    }

    const parsed = ts.parseJsonConfigFileContent(
        configFile.config,
        ts.sys,
        path.dirname(configPath)
    );

    const program = ts.createProgram({
        rootNames: parsed.fileNames,
        options: parsed.options,
        projectReferences: parsed.projectReferences,
    });

    const preEmitDiagnostics = ts.getPreEmitDiagnostics(program);
    const emitResult = program.emit();
    const diagnostics = preEmitDiagnostics.concat(emitResult.diagnostics ?? []);
    const formatted = diagnostics.map(d => formatDiagnostic(ts, d));

    return {
        built: true,
        success: diagnostics.length === 0,
        diagnostics: formatted.length > 0 ? formatted : undefined,
    };
}
