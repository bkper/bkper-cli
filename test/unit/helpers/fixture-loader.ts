import fs from 'fs';
import path from 'path';
import { AppData } from './mock-interfaces.js';

// Centralized fixture loading
export function loadFixture<T>(testDir: string, fixtureName: string): T[] {
    // testDir is the directory containing the test file
    // Navigate to test/unit/fixtures/ from any test directory
    let fixturePath: string;
    if (testDir.includes('/unit/commands/apps') || testDir.includes('/unit/tools/')) {
        // Nested directories like test/unit/commands/apps/ or test/unit/tools/subdir/
        fixturePath = path.join(testDir, '..', '..', 'fixtures', fixtureName);
    } else if (testDir.includes('/unit/tools') || testDir.includes('/unit/commands')) {
        fixturePath = path.join(testDir, '..', 'fixtures', fixtureName);
    } else if (testDir.includes('/unit')) {
        fixturePath = path.join(testDir, 'fixtures', fixtureName);
    } else {
        // Fallback for other locations
        fixturePath = path.join(testDir, 'fixtures', fixtureName);
    }
    return JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
}

export function loadFixtureObject<T>(testDir: string, fixtureName: string): T {
    let fixturePath: string;
    if (testDir.includes('/unit/commands/apps') || testDir.includes('/unit/tools/')) {
        fixturePath = path.join(testDir, '..', '..', 'fixtures', fixtureName);
    } else if (testDir.includes('/unit/tools') || testDir.includes('/unit/commands')) {
        fixturePath = path.join(testDir, '..', 'fixtures', fixtureName);
    } else if (testDir.includes('/unit')) {
        fixturePath = path.join(testDir, 'fixtures', fixtureName);
    } else {
        fixturePath = path.join(testDir, 'fixtures', fixtureName);
    }
    return JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
}

// Load specific fixture types
export function loadApps(testDir: string): AppData[] {
    return loadFixture<AppData>(testDir, 'sample-apps.json');
}
