import { expect } from 'chai';
import { fileURLToPath } from 'url';
import path from 'path';

// Common test setup utilities
export { expect };

export function getTestPaths(importMetaUrl: string) {
    const __filename = fileURLToPath(importMetaUrl);
    const __dirname = path.dirname(__filename);
    return { __filename, __dirname };
}

export function setupTestEnvironment() {
    process.env.BKPER_API_KEY = 'test-api-key';
}

export function getFixturePath(testDir: string, fixtureName: string): string {
    return path.join(testDir, '../fixtures', fixtureName);
}
