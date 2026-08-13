import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';
import * as tar from 'tar';
import * as YAML from 'yaml';
import { ensureGitInitialized } from './git/inspect.js';

// =============================================================================
// Constants
// =============================================================================

const TEMPLATE_REPO = 'bkper/bkper-app-template';
const TEMPLATE_BRANCH = 'main';

export interface AppInitTarget {
    appName: string;
    targetDir: string;
    displayTarget: string;
}

const ALLOWED_CURRENT_DIRECTORY_ENTRIES = new Set(['.git', '.gitignore', '.gitattributes', '.pi']);
const AGENT_GUIDANCE_MARKERS = [
    '<!-- APP_STANDARDS:START -->',
    '<!-- APP_STANDARDS:END -->',
    '<!-- APP_SPECIFICS:START -->',
    '<!-- APP_SPECIFICS:END -->',
] as const;

export function resolveInitTarget(name: string | undefined, cwd = process.cwd()): AppInitTarget {
    if (name) {
        return {
            appName: name,
            targetDir: path.resolve(cwd, name),
            displayTarget: name,
        };
    }

    const targetDir = path.resolve(cwd);
    return {
        appName: path.basename(targetDir),
        targetDir,
        displayTarget: '.',
    };
}

export function assertInitTargetAvailable(target: AppInitTarget): void {
    if (!fs.existsSync(target.targetDir)) {
        return;
    }

    const unsafeEntries = fs
        .readdirSync(target.targetDir)
        .filter(entry => !ALLOWED_CURRENT_DIRECTORY_ENTRIES.has(entry))
        .sort();

    if (unsafeEntries.length > 0) {
        const targetLabel =
            target.displayTarget === '.'
                ? 'Current directory'
                : `Directory '${target.displayTarget}'`;
        throw new Error(
            `${targetLabel} contains files that are not safe to overwrite: ${unsafeEntries.join(', ')}`
        );
    }
}

// =============================================================================
// Validation
// =============================================================================

export function validateAgentGuidance(contents: string): string[] {
    const lines = contents.split(/\r?\n/).map(line => line.trim());
    const failures: string[] = [];
    const malformedLines = lines.filter(
        line =>
            /<!--.*APP_(?:STANDARDS|SPECIFICS)/.test(line) &&
            !AGENT_GUIDANCE_MARKERS.some(marker => marker === line)
    );

    if (malformedLines.length > 0) {
        failures.push(`Malformed agent guidance marker: ${malformedLines.join(', ')}`);
    }

    const markerIndexes = AGENT_GUIDANCE_MARKERS.map(marker =>
        lines.flatMap((line, index) => (line === marker ? [index] : []))
    );

    for (let index = 0; index < AGENT_GUIDANCE_MARKERS.length; index += 1) {
        if (markerIndexes[index].length !== 1) {
            failures.push(`AGENTS.md must contain exactly one ${AGENT_GUIDANCE_MARKERS[index]}`);
        }
    }

    if (
        markerIndexes.every(indexes => indexes.length === 1) &&
        !markerIndexes.every(
            (indexes, index) => index === 0 || markerIndexes[index - 1][0] < indexes[0]
        )
    ) {
        failures.push(
            `AGENTS.md markers must appear in this order: ${AGENT_GUIDANCE_MARKERS.join(', ')}`
        );
    }

    return failures;
}

export function getAgentGuidanceDisplayPath(target: AppInitTarget): string {
    return target.displayTarget === '.'
        ? './AGENTS.md'
        : `./${target.displayTarget}/AGENTS.md`;
}

function assertTemplateAgentGuidance(projectDir: string): void {
    const agentsPath = path.join(projectDir, 'AGENTS.md');
    if (!fs.existsSync(agentsPath)) {
        throw new Error('AGENTS.md is missing');
    }

    const failures = validateAgentGuidance(fs.readFileSync(agentsPath, 'utf8'));
    if (failures.length > 0) {
        throw new Error(failures.join('; '));
    }
}

/**
 * Validates that the app name is a valid app identifier.
 * Rules: lowercase, no spaces, starts with letter, only alphanumeric and hyphens
 */
function validateAppName(name: string): { valid: boolean; error?: string } {
    if (!name || name.trim().length === 0) {
        return { valid: false, error: 'App name cannot be empty' };
    }

    if (!/^[a-z]/.test(name)) {
        return { valid: false, error: 'App name must start with a lowercase letter' };
    }

    if (!/^[a-z0-9-]+$/.test(name)) {
        return {
            valid: false,
            error: 'App name can only contain lowercase letters, numbers, and hyphens',
        };
    }

    if (name.length > 214) {
        return { valid: false, error: 'App name must be 214 characters or less' };
    }

    return { valid: true };
}

// =============================================================================
// Template Download
// =============================================================================

/**
 * Downloads and extracts the template tarball from GitHub.
 */
async function downloadTemplate(targetDir: string): Promise<void> {
    const tarballUrl = `https://github.com/${TEMPLATE_REPO}/archive/refs/heads/${TEMPLATE_BRANCH}.tar.gz`;

    const response = await fetch(tarballUrl, {
        headers: {
            'User-Agent': 'bkper-cli',
        },
    });

    if (!response.ok) {
        throw new Error(`Failed to download template: ${response.statusText}`);
    }

    // Create parent directory
    fs.mkdirSync(targetDir, { recursive: true });

    // Convert Web ReadableStream to Node.js Readable
    const reader = response.body?.getReader();
    if (!reader) {
        throw new Error('Failed to get response body reader');
    }

    const nodeStream = new Readable({
        async read() {
            const { done, value } = await reader.read();
            if (done) {
                this.push(null);
            } else {
                this.push(Buffer.from(value));
            }
        },
    });

    // Extract tarball, stripping the first directory component
    await new Promise<void>((resolve, reject) => {
        nodeStream
            .pipe(
                tar.extract({
                    cwd: targetDir,
                    keep: true,
                    strip: 1, // Remove the "bkper-app-template-main" prefix
                })
            )
            .on('finish', resolve)
            .on('error', reject);
    });
}

// =============================================================================
// Project Configuration
// =============================================================================

/**
 * Recursively replaces 'my-app' with the new app name in all string values.
 */
export function replaceMyAppInObject(obj: unknown, appName: string): unknown {
    if (typeof obj === 'string') {
        return obj.replace(/my-app/g, appName);
    }
    if (Array.isArray(obj)) {
        return obj.map(item => replaceMyAppInObject(item, appName));
    }
    if (obj && typeof obj === 'object') {
        const result: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(obj)) {
            result[key] = replaceMyAppInObject(value, appName);
        }
        return result;
    }
    return obj;
}

/**
 * Updates the bkper.yaml file with the new app name.
 */
function updateBkperYaml(projectDir: string, appName: string): void {
    const yamlPath = path.join(projectDir, 'bkper.yaml');

    if (!fs.existsSync(yamlPath)) {
        throw new Error('bkper.yaml not found in template');
    }

    const content = fs.readFileSync(yamlPath, 'utf8');
    const config = YAML.parse(content);

    // Update the id field
    config.id = appName;

    // Update the name field if it exists (make it more readable)
    if (config.name) {
        config.name = appName
            .split('-')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    }

    // Replace all remaining 'my-app' placeholders in URLs and other values
    const updatedConfig = replaceMyAppInObject(config, appName) as typeof config;

    fs.writeFileSync(yamlPath, YAML.stringify(updatedConfig), 'utf8');
}

/**
 * Replaces the placeholder app id 'my-app' in server source files.
 */
export function updateEventHandlers(projectDir: string, appName: string): void {
    const serverDir = path.join(projectDir, 'server/src');
    if (!fs.existsSync(serverDir)) {
        return;
    }

    function processDir(dir: string) {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                processDir(fullPath);
            } else if (entry.name.endsWith('.ts')) {
                let content = fs.readFileSync(fullPath, 'utf8');
                const original = content;
                content = content.replace(/(['"])my-app\1/g, `$1${appName}$1`);
                if (content !== original) {
                    fs.writeFileSync(fullPath, content, 'utf8');
                }
            }
        }
    }

    processDir(serverDir);
}

/**
 * Updates the package.json file with the new app name.
 */
function updatePackageJson(projectDir: string, appName: string): void {
    const packagePath = path.join(projectDir, 'package.json');

    if (!fs.existsSync(packagePath)) {
        throw new Error('package.json not found in template');
    }

    const content = fs.readFileSync(packagePath, 'utf8');
    const pkg = JSON.parse(content);

    pkg.name = appName;

    fs.writeFileSync(packagePath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
}

// =============================================================================
// Public API
// =============================================================================

/**
 * Initializes a new Bkper app from the template.
 *
 * @param name - Optional name of the new app (used as app id). Defaults to the current directory name.
 */
export async function initApp(name?: string): Promise<void> {
    const initTarget = resolveInitTarget(name);

    // 1. Validate app name
    const validation = validateAppName(initTarget.appName);
    if (!validation.valid) {
        console.error(`Error: ${validation.error}`);
        process.exit(1);
    }

    // 2. Check target safety
    try {
        assertInitTargetAvailable(initTarget);
    } catch (err) {
        console.error('Error:', err instanceof Error ? err.message : err);
        process.exit(1);
    }

    const targetExistsBeforeDownload = fs.existsSync(initTarget.targetDir);
    const targetDescription =
        initTarget.displayTarget === '.'
            ? 'the current directory'
            : `./${initTarget.displayTarget}`;
    console.log(`\nCreating Bkper app '${initTarget.appName}' in ${targetDescription}...\n`);

    // 3. Download template
    try {
        await downloadTemplate(initTarget.targetDir);
        console.log('  Downloaded template');
    } catch (err) {
        console.error('Error downloading template:', err instanceof Error ? err.message : err);
        if (!targetExistsBeforeDownload && fs.existsSync(initTarget.targetDir)) {
            fs.rmSync(initTarget.targetDir, { recursive: true, force: true });
        }
        process.exit(1);
    }

    // 4. Validate protected agent guidance structure before customizing the scaffold.
    try {
        assertTemplateAgentGuidance(initTarget.targetDir);
        console.log('  Validated AGENTS.md guidance');
    } catch (err) {
        console.error(
            'Error: Invalid app template agent guidance:',
            err instanceof Error ? err.message : err
        );
        if (!targetExistsBeforeDownload && fs.existsSync(initTarget.targetDir)) {
            fs.rmSync(initTarget.targetDir, { recursive: true, force: true });
        }
        process.exit(1);
    }

    // 5. Update bkper.yaml
    try {
        updateBkperYaml(initTarget.targetDir, initTarget.appName);
        console.log('  Updated bkper.yaml');
    } catch (err) {
        console.error('Error updating bkper.yaml:', err instanceof Error ? err.message : err);
        process.exit(1);
    }

    // 6. Update event handler loop guards
    try {
        updateEventHandlers(initTarget.targetDir, initTarget.appName);
        console.log('  Updated event handlers');
    } catch (err) {
        console.error('Error updating event handlers:', err instanceof Error ? err.message : err);
        process.exit(1);
    }

    // 7. Update package.json
    try {
        updatePackageJson(initTarget.targetDir, initTarget.appName);
        console.log('  Updated package.json');
    } catch (err) {
        console.error('Error updating package.json:', err instanceof Error ? err.message : err);
        process.exit(1);
    }

    // 8. Initialize Git on main without staging or committing when not already a repo.
    try {
        const created = await ensureGitInitialized(initTarget.targetDir);
        if (created) {
            console.log('  Initialized Git repository on main');
        } else {
            console.log('  Existing Git repository preserved');
        }
    } catch (err) {
        console.log(
            '  Warning: Could not initialize Git. Run "git init -b main" manually if needed.'
        );
    }

    const enterProject =
        initTarget.displayTarget === '.'
            ? ''
            : `\nEnter the project directory:\n\n  cd ${initTarget.displayTarget}\n`;
    const agentGuidancePath = getAgentGuidanceDisplayPath(initTarget);

    // 9. Print success message and hand the scaffold to the active coding agent.
    console.log(`
Done! Dependencies were not installed. Follow the scaffold's setup instructions before development.
${enterProject}
Agent handoff:
  - Active coding agent: read ${agentGuidancePath} before making changes
  - Preserve APP_STANDARDS unless explicitly asked to change it
  - Maintain APP_SPECIFICS as the app purpose, behavior, domain flows, resources, routes, and implementation decisions evolve
  - Preserve both APP_STANDARDS and APP_SPECIFICS marker pairs

Next steps:
  - Review bkper.yaml: update description, ownerName, ownerWebsite, and developers
  - Replace logo-light.svg and logo-dark.svg in client/public/images/
  - Edit README.md to explain what your app does for end users
  - Commit your changes on main, then run: bkper app sync
  - To use an external Git provider instead, add its remote before the first sync
`);
}
