import {accessSync, constants} from 'node:fs';
import {access, readFile, stat} from 'node:fs/promises';
import {homedir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import type {ImageContent} from '@earendil-works/pi-ai';
import {convertToPng, detectSupportedImageMimeTypeFromFile} from '@earendil-works/pi-coding-agent';
import {AgentStartupError} from '../startup-error.js';

/**
 * The first user turn of an interactive session started with message and `@file` arguments.
 *
 * Pi builds it in `main()` with `processFileArguments` and `buildInitialMessage`, which it does not
 * export. This module mirrors them (Pi `cli/file-processor`, `cli/initial-message`,
 * `core/tools/path-utils`, `utils/paths`, `utils/image-process`) so `bkper agent @file message`
 * starts like `pi @file message`.
 */
export interface InitialPrompt {
    initialMessage?: string;
    initialImages?: ImageContent[];
    initialMessages?: string[];
}

const UNICODE_SPACES = /[\u00A0\u2000-\u200A\u202F\u205F\u3000]/g;
const NARROW_NO_BREAK_SPACE = '\u202F';
const NATIVE_IMAGE_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp']);

/** Converts Git Bash, MSYS, Cygwin, and WSL drive paths to native Windows paths. */
function normalizeWindowsShellPath(filePath: string): string {
    if (!filePath.startsWith('/') || filePath.startsWith('//') || filePath.includes('\\')) {
        return filePath;
    }
    const match = filePath.match(/^\/(?:mnt\/|cygdrive\/)?([a-z])(?:\/(.*))?$/i);
    if (!match) {
        return filePath;
    }
    return `${match[1].toUpperCase()}:\\${match[2]?.split('/').join('\\') ?? ''}`;
}

function normalizeFilePath(input: string, platform: NodeJS.Platform): string {
    let normalized = input.replace(UNICODE_SPACES, ' ');
    if (normalized.startsWith('@')) {
        normalized = normalized.slice(1);
    }
    if (platform === 'win32') {
        normalized = normalizeWindowsShellPath(normalized);
    }
    if (normalized === '~') {
        return homedir();
    }
    if (normalized.startsWith('~/') || (platform === 'win32' && normalized.startsWith('~\\'))) {
        return path.join(homedir(), normalized.slice(2));
    }
    return /^file:\/\//.test(normalized) ? fileURLToPath(normalized) : normalized;
}

function fileExists(filePath: string): boolean {
    try {
        accessSync(filePath, constants.F_OK);
        return true;
    } catch {
        return false;
    }
}

/**
 * Resolves a file argument against cwd, falling back to how macOS names screenshots: a narrow
 * no-break space before AM/PM, NFD-normalized names, and curly apostrophes.
 */
export function resolveFileArgumentPath(
    file: string,
    cwd: string,
    platform: NodeJS.Platform = process.platform
): string {
    const resolved = path.resolve(cwd, normalizeFilePath(file, platform));
    if (fileExists(resolved)) {
        return resolved;
    }
    const nfd = resolved.normalize('NFD');
    const variants = [
        resolved.replace(/ (AM|PM)\./gi, `${NARROW_NO_BREAK_SPACE}$1.`),
        nfd,
        resolved.replace(/'/g, '\u2019'),
        nfd.replace(/'/g, '\u2019'),
    ];
    return variants.find(variant => variant !== resolved && fileExists(variant)) ?? resolved;
}

type FileContent = {text: string; image?: ImageContent};

async function readImageFile(filePath: string, mimeType: string): Promise<FileContent> {
    const data = (await readFile(filePath)).toString('base64');
    if (NATIVE_IMAGE_MIME_TYPES.has(mimeType)) {
        return {text: `<file name="${filePath}"></file>\n`, image: {type: 'image', mimeType, data}};
    }

    const converted = await convertToPng(data, mimeType);
    if (!converted) {
        return {
            text: `<file name="${filePath}">[Image omitted: could not be converted to a supported inline image format.]</file>\n`,
        };
    }
    return {
        text: `<file name="${filePath}">[Image converted from ${mimeType} to ${converted.mimeType}.]</file>\n`,
        image: {type: 'image', mimeType: converted.mimeType, data: converted.data},
    };
}

async function readTextFile(filePath: string): Promise<FileContent> {
    let content: string;
    try {
        content = await readFile(filePath, 'utf-8');
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new AgentStartupError(`Could not read file ${filePath}: ${message}`);
    }
    const text = content.startsWith('\uFEFF') ? content.slice(1) : content;
    return {text: `<file name="${filePath}">\n${text}\n</file>\n`};
}

/**
 * Builds the first user turn as Pi does for `pi [@files...] [messages...]`: file contents and the
 * first message form the initial message, and the remaining messages follow as separate turns.
 */
export async function buildInitialPrompt(
    messages: string[] = [],
    fileArgs: string[] = [],
    cwd: string = process.cwd()
): Promise<InitialPrompt> {
    const parts: string[] = [];
    const images: ImageContent[] = [];

    let fileText = '';
    for (const file of fileArgs) {
        const filePath = resolveFileArgumentPath(file, cwd);
        try {
            await access(filePath);
        } catch {
            throw new AgentStartupError(`File not found: ${filePath}`);
        }
        if ((await stat(filePath)).size === 0) {
            continue;
        }

        const mimeType = await detectSupportedImageMimeTypeFromFile(filePath);
        const content = mimeType
            ? await readImageFile(filePath, mimeType)
            : await readTextFile(filePath);
        fileText += content.text;
        if (content.image) {
            images.push(content.image);
        }
    }

    if (fileText) {
        parts.push(fileText);
    }
    const [firstMessage, ...initialMessages] = messages;
    if (firstMessage !== undefined) {
        parts.push(firstMessage);
    }

    return {
        ...(parts.length > 0 ? {initialMessage: parts.join('')} : {}),
        ...(images.length > 0 ? {initialImages: images} : {}),
        ...(initialMessages.length > 0 ? {initialMessages} : {}),
    };
}
