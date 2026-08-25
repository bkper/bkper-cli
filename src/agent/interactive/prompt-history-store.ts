import {
    appendFileSync,
    chmodSync,
    mkdirSync,
    readFileSync,
    renameSync,
    statSync,
    unlinkSync,
    writeFileSync,
} from 'node:fs';
import path from 'node:path';
import {fuzzyFilter} from '@earendil-works/pi-tui';

export type PromptHistoryKind = 'standard' | 'handoff' | 'bash';

export interface PromptHistoryEntry {
    text: string;
    kind: PromptHistoryKind;
    timestamp: number;
}

export interface PromptHistoryRecorder {
    record(text: string, kind: PromptHistoryKind, timestamp?: number): void;
}

export interface PromptHistoryRepository extends PromptHistoryRecorder {
    getEntries(): readonly PromptHistoryEntry[];
}

export interface PromptHistorySearchOptions {
    includeBash: boolean;
    limit?: number;
}

export interface FilePromptHistoryOptions {
    maxEntries?: number;
    trimRecordCount?: number;
    maxFileBytes?: number;
}

const DEFAULT_MAX_ENTRIES = 10_000;
const DEFAULT_TRIM_RECORD_COUNT = 20_000;
const DEFAULT_MAX_FILE_BYTES = 16 * 1024 * 1024;
const DEFAULT_SEARCH_LIMIT = 10;

function isPromptHistoryKind(value: unknown): value is PromptHistoryKind {
    return value === 'standard' || value === 'handoff' || value === 'bash';
}

function parseEntry(line: string): PromptHistoryEntry | undefined {
    try {
        const value: unknown = JSON.parse(line);
        if (typeof value !== 'object' || value === null) {
            return undefined;
        }
        const record = value as Record<string, unknown>;
        if (
            typeof record.text !== 'string' ||
            !record.text.trim() ||
            !isPromptHistoryKind(record.kind) ||
            typeof record.timestamp !== 'number' ||
            !Number.isFinite(record.timestamp)
        ) {
            return undefined;
        }
        return {
            text: record.text,
            kind: record.kind,
            timestamp: record.timestamp,
        };
    } catch {
        return undefined;
    }
}

function serializeEntry(entry: PromptHistoryEntry): string {
    return `${JSON.stringify(entry)}\n`;
}

function positiveInteger(value: number | undefined, fallback: number): number {
    return value !== undefined && Number.isInteger(value) && value > 0 ? value : fallback;
}

export function searchPromptHistoryEntries(
    entries: readonly PromptHistoryEntry[],
    query: string,
    options: PromptHistorySearchOptions
): PromptHistoryEntry[] {
    const uniqueEntries: PromptHistoryEntry[] = [];
    const seen = new Set<string>();

    for (const entry of entries) {
        if ((!options.includeBash && entry.kind === 'bash') || seen.has(entry.text)) {
            continue;
        }
        seen.add(entry.text);
        uniqueEntries.push(entry);
    }

    return fuzzyFilter(uniqueEntries, query, entry => entry.text).slice(
        0,
        options.limit ?? DEFAULT_SEARCH_LIMIT
    );
}

export class FilePromptHistory implements PromptHistoryRepository {
    private readonly maxEntries: number;
    private readonly trimRecordCount: number;
    private readonly maxFileBytes: number;
    private entries: PromptHistoryEntry[] = [];
    private recordCount = 0;
    private fileBytes = 0;

    constructor(
        private readonly filePath: string,
        options: FilePromptHistoryOptions = {}
    ) {
        this.maxEntries = positiveInteger(options.maxEntries, DEFAULT_MAX_ENTRIES);
        this.trimRecordCount = Math.max(
            this.maxEntries,
            positiveInteger(options.trimRecordCount, DEFAULT_TRIM_RECORD_COUNT)
        );
        this.maxFileBytes = positiveInteger(options.maxFileBytes, DEFAULT_MAX_FILE_BYTES);
        this.load();
    }

    getEntries(): readonly PromptHistoryEntry[] {
        return this.entries;
    }

    record(text: string, kind: PromptHistoryKind, timestamp = Date.now()): void {
        const normalized = text.trim();
        if (!normalized) {
            return;
        }

        const entry: PromptHistoryEntry = {text: normalized, kind, timestamp};
        const serialized = serializeEntry(entry);
        this.entries.unshift(entry);
        if (this.entries.length > this.maxEntries) {
            this.entries.pop();
        }

        try {
            mkdirSync(path.dirname(this.filePath), {recursive: true});
            appendFileSync(this.filePath, serialized, {encoding: 'utf8', mode: 0o600});
            this.recordCount++;
            this.fileBytes += Buffer.byteLength(serialized);
            if (
                this.recordCount >= this.trimRecordCount ||
                this.fileBytes >= this.maxFileBytes
            ) {
                this.rotate();
            }
        } catch {
            // Prompt history is a best-effort convenience cache.
        }
    }

    private load(): void {
        let content: string;
        try {
            content = readFileSync(this.filePath, 'utf8');
            chmodSync(this.filePath, 0o600);
            this.fileBytes = statSync(this.filePath).size;
        } catch {
            return;
        }

        const lines = content.split('\n').filter(line => line.trim().length > 0);
        this.recordCount = lines.length;
        this.entries = lines
            .map(parseEntry)
            .filter((entry): entry is PromptHistoryEntry => entry !== undefined)
            .slice(-this.maxEntries)
            .reverse();

        if (
            this.recordCount >= this.trimRecordCount ||
            this.fileBytes >= this.maxFileBytes
        ) {
            this.rotate();
        }
    }

    private rotate(): void {
        const retainedNewest: PromptHistoryEntry[] = [];
        let retainedBytes = 0;

        for (const entry of this.entries) {
            if (retainedNewest.length >= this.maxEntries) {
                break;
            }
            const bytes = Buffer.byteLength(serializeEntry(entry));
            if (retainedBytes + bytes > this.maxFileBytes) {
                break;
            }
            retainedNewest.push(entry);
            retainedBytes += bytes;
        }

        const content = retainedNewest
            .slice()
            .reverse()
            .map(serializeEntry)
            .join('');
        const temporaryPath = `${this.filePath}.${process.pid}.${Date.now()}.tmp`;

        try {
            mkdirSync(path.dirname(this.filePath), {recursive: true});
            writeFileSync(temporaryPath, content, {encoding: 'utf8', mode: 0o600});
            renameSync(temporaryPath, this.filePath);
            this.entries = retainedNewest;
            this.recordCount = retainedNewest.length;
            this.fileBytes = Buffer.byteLength(content);
        } catch {
            try {
                unlinkSync(temporaryPath);
            } catch {
                // Ignore cleanup failures for the best-effort cache.
            }
        }
    }
}

export function getPromptHistoryPath(agentDir: string): string {
    return path.join(agentDir, 'bkper-input-history.jsonl');
}
