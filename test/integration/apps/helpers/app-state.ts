import { execFileSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { runCli, runCommand } from './cli-helpers.js';

const REPO_ROOT = path.resolve(import.meta.dirname, '../../../..');
const APP_NAME = 'my-app';
// Generated apps hold ~600MB of node_modules; keep them on the local temp disk, not the repo,
// which may sit on a slow shared mount.
const TEMP_ROOT = path.join(os.tmpdir(), 'bkper-cli-app-tests');
const CACHE_DIR = path.join(TEMP_ROOT, 'app-state-cache');

/**
 * Generated apps live inside a throwaway parent Git repository, like apps created inside an
 * existing project, so `bkper app init` keeps the parent repository instead of creating its own.
 */
function ensureTempRoot(): void {
    fs.mkdirSync(TEMP_ROOT, { recursive: true });
    if (!fs.existsSync(path.join(TEMP_ROOT, '.git'))) {
        execFileSync('git', ['init', '-q'], { cwd: TEMP_ROOT });
    }
}

export type AppState = 'init' | 'installed' | 'built' | 'cleaned';

interface StateInfo {
    path: string;
    createdAt: number;
}

/**
 * Manages cached app directories at different lifecycle states.
 *
 * Each state represents an app that has reached a specific point in the lifecycle:
 * - 'init': App created with `bkper app init`, dependencies not installed
 * - 'installed': Initialized App with dependencies explicitly installed for later test states
 * - 'built': App has been built with the template build flow (client assets + server Worker)
 * - 'cleaned': App has been cleaned with `bun run clean` after being built
 *
 * States are lazily created and cached across test runs for efficiency.
 * Tests can request any state and get the appropriate app directory.
 */
export class AppStateManager {
    private states: Map<AppState, StateInfo> = new Map();
    private tempDir: string | null = null;

    /**
     * Get an app directory at the specified state.
     * Creates the state if it doesn't exist in cache.
     * Returns a fresh copy (not the cached original) to avoid test interference.
     */
    async getApp(state: AppState): Promise<string> {
        // Ensure prerequisite states exist
        await this.ensureState(state);

        // Return a copy of the cached state
        return this.copyState(state);
    }

    /**
     * Reset all cached states (use in global after hook)
     */
    async reset(): Promise<void> {
        // Clean up temp test directories
        if (this.tempDir && fs.existsSync(this.tempDir)) {
            fs.rmSync(this.tempDir, { recursive: true, force: true });
        }

        // Note: We intentionally keep the cache directory for reuse across test runs
        // To force recreation, call AppStateManager.clearCache()
    }

    /**
     * Force clear all cached states (use when you want fresh starts)
     */
    static clearCache(): void {
        if (fs.existsSync(CACHE_DIR)) {
            fs.rmSync(CACHE_DIR, { recursive: true, force: true });
        }
    }

    /**
     * Ensure a state exists in cache, creating it if necessary
     */
    private async ensureState(state: AppState): Promise<void> {
        if (this.states.has(state)) {
            return;
        }

        // Check if state exists on disk from previous runs
        const cachedPath = this.getCachePath(state);
        if (fs.existsSync(cachedPath)) {
            if (this.isCacheCompatible(state, cachedPath)) {
                this.states.set(state, {
                    path: cachedPath,
                    createdAt: fs.statSync(cachedPath).mtimeMs,
                });
                return;
            }
            fs.rmSync(cachedPath, { recursive: true, force: true });
        }

        // Create the state
        switch (state) {
            case 'init':
                await this.createInitState(cachedPath);
                break;
            case 'installed':
                await this.createInstalledState(cachedPath);
                break;
            case 'built':
                await this.createBuiltState(cachedPath);
                break;
            case 'cleaned':
                await this.createCleanedState(cachedPath);
                break;
        }

        this.states.set(state, {
            path: cachedPath,
            createdAt: Date.now(),
        });
    }

    /**
     * Create the 'init' state - fresh app without dependencies.
     */
    private async createInitState(targetPath: string): Promise<void> {
        ensureTempRoot();
        fs.mkdirSync(CACHE_DIR, { recursive: true });
        const tempParent = fs.mkdtempSync(path.join(CACHE_DIR, 'tmp-'));
        const appDir = path.join(tempParent, APP_NAME);

        await runCli(['app', 'init', APP_NAME], tempParent);

        fs.mkdirSync(path.dirname(targetPath), { recursive: true });
        fs.renameSync(appDir, targetPath);
        fs.rmSync(tempParent, { recursive: true, force: true });
    }

    /**
     * Create the 'installed' state for tests that need template dependencies.
     */
    private async createInstalledState(targetPath: string): Promise<void> {
        await this.ensureState('init');
        const initPath = this.states.get('init')!.path;

        this.copyDirectory(initPath, targetPath);
        await runCommand('bun', ['install'], targetPath);
        this.linkLocalBkper(targetPath);
    }

    /**
     * Create the 'built' state - installed dependencies + build artifacts.
     */
    private async createBuiltState(targetPath: string): Promise<void> {
        await this.ensureState('installed');
        const installedPath = this.states.get('installed')!.path;

        this.copyDirectory(installedPath, targetPath);
        this.linkLocalBkper(targetPath);

        // Build client assets through the root workspace orchestrator, then bundle the Worker.
        // The template's scripts call `npm run --workspace`; bun ignores --workspace and recurses.
        await runCommand('npm', ['run', 'build:client'], targetPath);
        await runCli(['app', 'build'], targetPath);
    }

    /**
     * Create the 'cleaned' state - built + clean
     */
    private async createCleanedState(targetPath: string): Promise<void> {
        // Ensure built state exists
        await this.ensureState('built');
        const builtPath = this.states.get('built')!.path;

        // Copy built state
        this.copyDirectory(builtPath, targetPath);

        // Run clean
        await runCommand('npm', ['run', 'clean'], targetPath);
    }

    /**
     * Get a built app whose source is stored as Bkper-managed source, as deploys require.
     * Clones the App's managed source when it has one; otherwise enables managed source from a
     * built template app with `bkper app sync`, which works only while the App has none.
     */
    async getManagedApp(): Promise<string> {
        const cloneParent = fs.mkdtempSync(path.join(this.getTempDir(), 'clone-'));
        const clonePath = path.join(cloneParent, APP_NAME);
        try {
            await runCli(['app', 'clone', APP_NAME, clonePath], cloneParent);
        } catch {
            // Managed source stores the app as its own repository.
            const appDir = await this.getApp('built');
            await runCommand('git', ['init', '-q'], appDir);
            await runCommand('git', ['add', '-A'], appDir);
            await runCommand(
                'git',
                ['-c', 'user.name=Bkper CLI tests', '-c', 'user.email=tests@bkper.com', 'commit', '-qm', 'Test app'],
                appDir
            );
            await runCli(['app', 'sync'], appDir);
            return appDir;
        }

        await runCommand('bun', ['install'], clonePath);
        this.linkLocalBkper(clonePath);
        await runCommand('npm', ['run', 'build:client'], clonePath);
        await runCli(['app', 'build'], clonePath);
        return clonePath;
    }

    private getTempDir(): string {
        if (!this.tempDir) {
            ensureTempRoot();
            this.tempDir = fs.mkdtempSync(path.join(TEMP_ROOT, 'app-test-'));
        }
        return this.tempDir;
    }

    /**
     * Copy a cached state to a temporary location for test use
     */
    private copyState(state: AppState): string {
        const stateInfo = this.states.get(state);
        if (!stateInfo) {
            throw new Error(`State '${state}' not found`);
        }

        const copyPath = path.join(this.getTempDir(), `${state}-${Date.now()}`);
        this.copyDirectory(stateInfo.path, copyPath);

        return copyPath;
    }

    /**
     * Get the cache path for a state
     */
    private getCachePath(state: AppState): string {
        return path.join(CACHE_DIR, `${state}-cache`, APP_NAME);
    }

    /**
     * Checks whether a cached app state is self-sufficient for the integration tests.
     *
     * This intentionally validates only the cached app itself and the local bkper link.
     * It must not depend on another workspace project being present.
     */
    private isCacheCompatible(state: AppState, cachedPath: string): boolean {
        if (!this.hasBaseAppStructure(cachedPath)) {
            return false;
        }

        if (state === 'cleaned') {
            return (
                !fs.existsSync(path.join(cachedPath, 'dist')) &&
                !fs.existsSync(path.join(cachedPath, 'node_modules'))
            );
        }

        if (state === 'init') {
            return !fs.existsSync(path.join(cachedPath, 'node_modules'));
        }

        if (!this.hasLocalBkperLink(cachedPath)) {
            return false;
        }

        if (state === 'installed') {
            return this.hasInitTooling(cachedPath);
        }

        if (state === 'built') {
            return (
                this.hasInitTooling(cachedPath) &&
                fs.existsSync(path.join(cachedPath, 'dist/server/index.js')) &&
                fs.existsSync(path.join(cachedPath, 'dist/client'))
            );
        }

        return false;
    }

    /**
     * Validates the minimal structure expected from `bkper app init`.
     */
    private hasBaseAppStructure(appDir: string): boolean {
        return ['package.json', 'bkper.yaml', 'client', 'server'].every(relativePath =>
            fs.existsSync(path.join(appDir, relativePath))
        );
    }

    /**
     * Validates tooling required by the build/dev/deploy integration tests.
     */
    private hasInitTooling(appDir: string): boolean {
        return [
            'node_modules',
            'node_modules/miniflare/package.json',
            'node_modules/vite/package.json',
        ].every(relativePath => fs.existsSync(path.join(appDir, relativePath)));
    }

    /**
     * Ensures the generated app can import the local bkper package.
     */
    private linkLocalBkper(appDir: string): void {
        const nodeModulesDir = path.join(appDir, 'node_modules');
        const targetPath = path.join(nodeModulesDir, 'bkper');
        const sourcePath = REPO_ROOT;

        fs.mkdirSync(nodeModulesDir, { recursive: true });
        if (fs.existsSync(targetPath)) {
            fs.rmSync(targetPath, { recursive: true, force: true });
        }
        fs.symlinkSync(sourcePath, targetPath, 'dir');
    }

    /**
     * Checks whether the cached app keeps a link to the local bkper package.
     */
    private hasLocalBkperLink(appDir: string): boolean {
        return fs.existsSync(path.join(appDir, 'node_modules', 'bkper', 'package.json'));
    }

    /**
     * Recursively copy a directory
     */
    private copyDirectory(src: string, dest: string): void {
        fs.mkdirSync(dest, { recursive: true });
        const entries = fs.readdirSync(src, { withFileTypes: true });

        for (const entry of entries) {
            const srcPath = path.join(src, entry.name);
            const destPath = path.join(dest, entry.name);

            if (entry.isDirectory()) {
                this.copyDirectory(srcPath, destPath);
            } else if (entry.isSymbolicLink()) {
                const linkTarget = fs.readlinkSync(srcPath);
                fs.symlinkSync(linkTarget, destPath);
            } else {
                fs.copyFileSync(srcPath, destPath);
            }
        }
    }
}
