import {
    createBashToolDefinition,
    createEditToolDefinition,
    createReadToolDefinition,
    createWriteToolDefinition,
} from '@earendil-works/pi-coding-agent';
import path from 'node:path';
import { expect } from '../helpers/test-setup.js';
import { getBkperAgentSystemPrompt } from '../../../src/agent/system-prompt.js';

describe('agent system prompt', function () {
    it('should point source-mode reference docs at skill/references', function () {
        const full = getBkperAgentSystemPrompt();

        expect(full).to.include(path.resolve('docs', 'index.md'));
        expect(full).to.include(path.resolve('skill', 'references'));
        expect(full).to.include(path.resolve('skill', 'references', 'core-concepts.md'));
    });

    it('should assemble tool guidance from pi tool definitions', function () {
        const full = getBkperAgentSystemPrompt();
        const definitions = [
            createReadToolDefinition(process.cwd()),
            createBashToolDefinition(process.cwd()),
            createEditToolDefinition(process.cwd()),
            createWriteToolDefinition(process.cwd()),
        ];
        expect(full).to.include('Available tools:');
        for (const definition of definitions) {
            if (definition.promptSnippet) {
                expect(full).to.include(`- ${definition.name}: ${definition.promptSnippet}`);
            }
            for (const guideline of definition.promptGuidelines ?? []) {
                expect(full).to.include(`- ${guideline}`);
            }
        }
    });
});
