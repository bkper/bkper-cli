export type ReleaseLevel = 'patch' | 'minor' | 'major';

const SEMVER_PATTERN = /^(\d+)\.(\d+)\.(\d+)$/;

export function normalizeTagVersion(versionOrTag: string): string {
    const normalized = versionOrTag.startsWith('v') ? versionOrTag.slice(1) : versionOrTag;

    if (!SEMVER_PATTERN.test(normalized)) {
        throw new Error(`Invalid semver version: ${versionOrTag}`);
    }

    return normalized;
}

export function bumpVersion(currentVersion: string, level: ReleaseLevel): string {
    const normalized = normalizeTagVersion(currentVersion);
    const match = normalized.match(SEMVER_PATTERN);

    if (!match) {
        throw new Error(`Invalid semver version: ${currentVersion}`);
    }

    const [, majorText, minorText, patchText] = match;
    const major = Number(majorText);
    const minor = Number(minorText);
    const patch = Number(patchText);

    switch (level) {
        case 'major':
            return `${major + 1}.0.0`;
        case 'minor':
            return `${major}.${minor + 1}.0`;
        case 'patch':
            return `${major}.${minor}.${patch + 1}`;
    }
}

export function resolveNextVersion(
    latestTag: string | null,
    packageVersion: string,
    level: ReleaseLevel
): string {
    const currentVersion = latestTag ? normalizeTagVersion(latestTag) : normalizeTagVersion(packageVersion);
    return bumpVersion(currentVersion, level);
}
