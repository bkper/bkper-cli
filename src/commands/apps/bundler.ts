import fs from "fs";
import path from "path";
import crypto from "crypto";

/**
 * Recursively gets all files in a directory.
 *
 * @param dir - Directory to scan
 * @returns Array of file paths
 */
export async function getFilesRecursive(dir: string): Promise<string[]> {
    const files: string[] = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            files.push(...await getFilesRecursive(fullPath));
        } else {
            files.push(fullPath);
        }
    }

    return files;
}

/**
 * Creates asset manifest for deployment.
 * Computes SHA-256 hashes for all files in the assets directory.
 *
 * @param assetsPath - Path to asset directory (relative to project root)
 * @returns Asset manifest with hashes and sizes
 */
export async function createAssetManifest(
    assetsPath: string
): Promise<Record<string, { hash: string; size: number }>> {
    const fullPath = path.resolve(assetsPath);
    if (!fs.existsSync(fullPath)) {
        throw new Error(`Assets directory not found: ${assetsPath}`);
    }

    const manifest: Record<string, { hash: string; size: number }> = {};
    const files = await getFilesRecursive(fullPath);

    for (const file of files) {
        const relativePath = "/" + path.relative(fullPath, file).replace(/\\/g, "/");
        const content = fs.readFileSync(file);
        const hash = computeHash(content);
        const size = fs.statSync(file).size;
        manifest[relativePath] = { hash, size };
    }

    return manifest;
}

/**
 * Computes SHA-256 hash of content.
 * Returns first 32 characters as per Cloudflare spec.
 *
 * @param content - File content as Buffer
 * @returns 32-character hex hash
 */
export function computeHash(content: Buffer): string {
    const hash = crypto.createHash("sha256").update(content).digest("hex");
    return hash.substring(0, 32);
}

/**
 * Reads asset file contents for deployment.
 * 
 * @param assetsPath - Path to asset directory
 * @returns Map of hash to base64-encoded content
 */
export async function readAssetFiles(
    assetsPath: string
): Promise<Record<string, string>> {
    const fullPath = path.resolve(assetsPath);
    if (!fs.existsSync(fullPath)) {
        throw new Error(`Assets directory not found: ${assetsPath}`);
    }

    const files = await getFilesRecursive(fullPath);
    const assetFiles: Record<string, string> = {};
    let totalSize = 0;
    const MAX_TOTAL_SIZE = 50 * 1024 * 1024; // 50 MB
    const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB (Cloudflare limit)
    const MAX_FILE_COUNT = 10000;

    if (files.length > MAX_FILE_COUNT) {
        throw new Error(`Too many asset files (${files.length}). Maximum is ${MAX_FILE_COUNT}.`);
    }

    for (const file of files) {
        const content = fs.readFileSync(file);
        const fileSize = content.length;

        if (fileSize > MAX_FILE_SIZE) {
            const fileName = path.relative(fullPath, file);
            throw new Error(`File ${fileName} exceeds 25 MB Cloudflare limit (${(fileSize / 1024 / 1024).toFixed(2)} MB)`);
        }

        totalSize += fileSize;
        if (totalSize > MAX_TOTAL_SIZE) {
            throw new Error(`Total asset size exceeds 50 MB limit (${(totalSize / 1024 / 1024).toFixed(2)} MB)`);
        }

        const hash = computeHash(content);
        const base64 = content.toString('base64');
        assetFiles[hash] = base64;
    }

    return assetFiles;
}
