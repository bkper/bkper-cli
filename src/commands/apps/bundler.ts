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
