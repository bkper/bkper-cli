import fs from 'fs';
import path from 'path';
import {randomUUID} from 'crypto';
import {
    ManagedGitError,
    SOURCE_MARKER_DIR,
    SOURCE_MARKER_FILE,
    type SourceMarker,
} from './types.js';

const UUID_V4_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export function getSourceMarkerPath(repoRoot: string): string {
    return path.join(repoRoot, SOURCE_MARKER_DIR, SOURCE_MARKER_FILE);
}

export function isUuidV4(value: string): boolean {
    return UUID_V4_RE.test(value);
}

export function createActivationId(): string {
    return randomUUID();
}

function parseSourceMarker(raw: string): SourceMarker {
    let parsed: unknown;
    try {
        parsed = JSON.parse(raw);
    } catch {
        throw new ManagedGitError(
            'SOURCE_MARKER_INVALID',
            'The local managed-source marker is malformed. Inspect .bkper/source-marker.json and restore a valid pending or managed marker before retrying.'
        );
    }

    if (!parsed || typeof parsed !== 'object') {
        throw new ManagedGitError(
            'SOURCE_MARKER_INVALID',
            'The local managed-source marker is malformed.'
        );
    }

    const marker = parsed as Record<string, unknown>;
    if (marker.version !== 1) {
        throw new ManagedGitError(
            'SOURCE_MARKER_INVALID',
            'Unsupported managed-source marker version.'
        );
    }

    if (marker.state === 'pending') {
        if (typeof marker.activationId !== 'string' || !isUuidV4(marker.activationId)) {
            throw new ManagedGitError(
                'SOURCE_MARKER_INVALID',
                'The pending managed-source marker must contain a lowercase UUID v4 activationId.'
            );
        }
        return {
            version: 1,
            state: 'pending',
            activationId: marker.activationId,
        };
    }

    if (marker.state === 'managed') {
        if (typeof marker.appId !== 'string' || marker.appId.length === 0) {
            throw new ManagedGitError(
                'SOURCE_MARKER_INVALID',
                'The managed-source marker is missing appId.'
            );
        }
        if (typeof marker.remote !== 'string' || marker.remote.length === 0) {
            throw new ManagedGitError(
                'SOURCE_MARKER_INVALID',
                'The managed-source marker is missing remote.'
            );
        }
        return {
            version: 1,
            state: 'managed',
            appId: marker.appId,
            remote: marker.remote,
        };
    }

    throw new ManagedGitError(
        'SOURCE_MARKER_INVALID',
        'The local managed-source marker has an unknown state.'
    );
}

export function readSourceMarker(repoRoot: string): SourceMarker | null {
    const markerPath = getSourceMarkerPath(repoRoot);
    if (!fs.existsSync(markerPath)) {
        return null;
    }
    return parseSourceMarker(fs.readFileSync(markerPath, 'utf8'));
}

function resolveGitDirectory(repoRoot: string): string | null {
    const dotGit = path.join(repoRoot, '.git');
    if (!fs.existsSync(dotGit)) return null;
    if (fs.statSync(dotGit).isDirectory()) return dotGit;
    const match = /^gitdir:\s*(.+)$/m.exec(fs.readFileSync(dotGit, 'utf8'));
    return match ? path.resolve(repoRoot, match[1]) : null;
}

function excludeSourceMarker(repoRoot: string): void {
    const gitDir = resolveGitDirectory(repoRoot);
    if (!gitDir) return;
    const infoDir = path.join(gitDir, 'info');
    const excludePath = path.join(infoDir, 'exclude');
    const pattern = `/${SOURCE_MARKER_DIR}/${SOURCE_MARKER_FILE}`;
    fs.mkdirSync(infoDir, {recursive: true});
    const existing = fs.existsSync(excludePath) ? fs.readFileSync(excludePath, 'utf8') : '';
    if (existing.split(/\r?\n/).includes(pattern)) return;
    const separator = existing.length > 0 && !existing.endsWith('\n') ? '\n' : '';
    fs.appendFileSync(excludePath, `${separator}${pattern}\n`, 'utf8');
}

function writeMarkerAtomic(repoRoot: string, marker: SourceMarker): void {
    excludeSourceMarker(repoRoot);
    const dir = path.join(repoRoot, SOURCE_MARKER_DIR);
    fs.mkdirSync(dir, {recursive: true});
    const markerPath = getSourceMarkerPath(repoRoot);
    const tempPath = `${markerPath}.${process.pid}.tmp`;
    fs.writeFileSync(tempPath, `${JSON.stringify(marker, null, 2)}\n`, 'utf8');
    fs.renameSync(tempPath, markerPath);
}

/**
 * Creates or returns the existing pending activation marker.
 * Does not overwrite a managed marker.
 */
export function ensurePendingSourceMarker(repoRoot: string): SourceMarker & {
    state: 'pending';
} {
    const existing = readSourceMarker(repoRoot);
    if (existing?.state === 'pending') {
        return existing;
    }
    if (existing?.state === 'managed') {
        throw new ManagedGitError(
            'SOURCE_MARKER_INVALID',
            'A managed-source marker already exists for this repository. Do not create a pending activation marker over it.'
        );
    }
    const marker: SourceMarker = {
        version: 1,
        state: 'pending',
        activationId: createActivationId(),
    };
    writeMarkerAtomic(repoRoot, marker);
    return marker;
}

export function writeManagedSourceMarker(
    repoRoot: string,
    appId: string,
    remote: string
): SourceMarker & {state: 'managed'} {
    const marker: SourceMarker = {
        version: 1,
        state: 'managed',
        appId,
        remote,
    };
    writeMarkerAtomic(repoRoot, marker);
    return marker;
}
