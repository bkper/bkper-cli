export const MINIMUM_NODE_VERSION = '22.19.0';

interface ParsedNodeVersion {
    major: number;
    minor: number;
    patch: number;
}

function parseNodeVersion(version: string): ParsedNodeVersion | undefined {
    const match = /^v?(\d+)\.(\d+)\.(\d+)/.exec(version);
    if (!match) {
        return undefined;
    }

    return {
        major: Number(match[1]),
        minor: Number(match[2]),
        patch: Number(match[3]),
    };
}

function compareNodeVersions(left: ParsedNodeVersion, right: ParsedNodeVersion): number {
    if (left.major !== right.major) {
        return left.major - right.major;
    }
    if (left.minor !== right.minor) {
        return left.minor - right.minor;
    }
    return left.patch - right.patch;
}

export function isSupportedNodeVersion(version: string): boolean {
    const parsedVersion = parseNodeVersion(version);
    const minimumVersion = parseNodeVersion(MINIMUM_NODE_VERSION);

    if (!parsedVersion || !minimumVersion) {
        return false;
    }

    return compareNodeVersions(parsedVersion, minimumVersion) >= 0;
}

export function getUnsupportedNodeVersionMessage(version: string): string | undefined {
    if (isSupportedNodeVersion(version)) {
        return undefined;
    }

    return [
        `Bkper CLI requires Node.js >= ${MINIMUM_NODE_VERSION}.`,
        `Current Node.js version: ${version}`,
        '',
        'Please upgrade Node.js, then reinstall Bkper CLI:',
        '  nvm install 22',
        '  nvm use 22',
        '  npm install -g bkper@latest',
    ].join('\n');
}
