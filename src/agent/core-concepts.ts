export const CORE_CONCEPTS_CANONICAL_URL = 'https://bkper.com/docs/core-concepts.md';

const REQUIRED_CORE_CONCEPTS_HEADINGS = [
    '# Core Concepts',
    '## Accounts',
    '## Transactions',
    '## Books',
] as const;

export function validateCoreConceptsMarkdown(markdown: string): void {
    if (!markdown.trim()) {
        throw new Error('Core concepts markdown is empty.');
    }

    for (const heading of REQUIRED_CORE_CONCEPTS_HEADINGS) {
        if (!markdown.includes(heading)) {
            throw new Error(`Core concepts markdown is missing required heading: ${heading}`);
        }
    }
}

export function renderCoreConceptsModule(markdown: string): string {
    validateCoreConceptsMarkdown(markdown);

    return `// AUTO-GENERATED FILE. DO NOT EDIT.\n// Source: ${CORE_CONCEPTS_CANONICAL_URL}\n\nexport const CORE_CONCEPTS_MARKDOWN = ${JSON.stringify(markdown)};\n`;
}
