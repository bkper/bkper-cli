import {
    createBashToolDefinition,
    createEditToolDefinition,
    createReadToolDefinition,
    createWriteToolDefinition,
} from '@mariozechner/pi-coding-agent';
import { expect } from '../helpers/test-setup.js';
import { BKPER_AGENT_SYSTEM_PROMPT, getBkperAgentSystemPrompt } from '../../../src/agent/system-prompt.js';

describe('agent system prompt', function () {
    it('should provide a non-empty prompt', function () {
        expect(BKPER_AGENT_SYSTEM_PROMPT.trim().length).to.be.greaterThan(0);
    });

    it('should contain the core identity instruction', function () {
        expect(BKPER_AGENT_SYSTEM_PROMPT).to.match(/You are a Bkper team member\.?/i);
        expect(BKPER_AGENT_SYSTEM_PROMPT).to.match(/Protect the zero-sum invariant above all else\.?/i);
    });

    it('should include tool guidance sourced from pi tool definitions', function () {
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
        expect(full).to.match(/Use bash for .*discovery.*search/i);
        expect(full).to.match(/bkper cli/i);
        expect(full).to.match(/bkper cli.*relevant|relevant.*bkper cli/i);
        expect(full).to.include(
            'Do not claim builds, tests, or command results unless you actually ran them.'
        );
    });

    it('should not include a partial core concepts canon', function () {
        expect(BKPER_AGENT_SYSTEM_PROMPT).to.not.include('## Core Concepts Canon');
        expect(BKPER_AGENT_SYSTEM_PROMPT).to.not.include('## Critical Flow Reminders');
        expect(BKPER_AGENT_SYSTEM_PROMPT).to.not.include('Credit card purchase: `Credit Card >> Outgoing`');
    });

    it('should route all Bkper tasks through core concepts and the docs index', function () {
        const full = getBkperAgentSystemPrompt();
        expect(full).to.match(/For any Bkper question or task/i);
        expect(full).to.match(/start by reading both/i);
        expect(full).to.match(/core-concepts\.md/i);
        expect(full).to.match(/index\.md/i);
    });

    it('should not include pi default identity or full doc routing block', function () {
        const full = getBkperAgentSystemPrompt();
        expect(full).to.not.match(/Pi documentation/i);
        expect(full).to.not.match(/expert coding assistant/i);
    });

    it('should include selective pi extension and tools doc routing', function () {
        const full = getBkperAgentSystemPrompt();
        expect(full).to.match(/pi extensions.*custom tools/i);
        expect(full).to.match(/pi-coding-agent/);
        expect(full).to.include('docs');
        expect(full).to.include('examples');
    });

    it('should not inline the full core concepts reference', function () {
        expect(BKPER_AGENT_SYSTEM_PROMPT).to.not.include('## Example Flows');
        expect(BKPER_AGENT_SYSTEM_PROMPT).to.not.include("These examples use Bkper's transaction shorthand `From >> To`");
    });

    it('should include llms.txt fallback for general Bkper questions', function () {
        const full = getBkperAgentSystemPrompt();
        expect(full).to.include('https://bkper.com/llms.txt');
        expect(full).to.match(/follow the most relevant link/i);
    });
});
