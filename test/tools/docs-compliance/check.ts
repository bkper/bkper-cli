import fs from 'node:fs';
import path from 'node:path';

import { evaluateReadmeCompliance } from '../../../src/docs-compliance/rules.js';

function printErrors(errors: ReturnType<typeof evaluateReadmeCompliance>['errors']): void {
    for (const error of errors) {
        const location = error.line ? ` (line ${error.line})` : '';
        console.error(`- [${error.code}] ${error.message}${location}`);
    }
}

function main(): void {
    const readmePath = process.argv[2]
        ? path.resolve(process.argv[2])
        : path.resolve(process.cwd(), 'README.md');

    if (!fs.existsSync(readmePath)) {
        console.error(`README not found at ${readmePath}`);
        process.exit(1);
    }

    const content = fs.readFileSync(readmePath, 'utf8');
    const result = evaluateReadmeCompliance(content);

    if (result.errors.length > 0) {
        console.error('Docs compliance check failed:');
        printErrors(result.errors);
        process.exit(1);
    }

    console.log(`Docs compliance passed for ${readmePath}`);
}

main();
