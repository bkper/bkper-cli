import { expect } from '../helpers/test-setup.js';
import { BKPER_AGENT_SYSTEM_PROMPT, getBkperAgentSystemPrompt } from '../../../src/agent/system-prompt.js';

describe('agent system prompt', function () {
    it('should provide a non-empty prompt', function () {
        expect(BKPER_AGENT_SYSTEM_PROMPT.trim().length).to.be.greaterThan(0);
    });

    it('should contain the core identity instruction', function () {
        expect(BKPER_AGENT_SYSTEM_PROMPT).to.include('You are a Bkper team member');
    });

    it('should include the core concepts canon', function () {
        expect(BKPER_AGENT_SYSTEM_PROMPT).to.include('## Core Concepts Canon');
        expect(BKPER_AGENT_SYSTEM_PROMPT).to.include('zero-sum invariant');
        expect(BKPER_AGENT_SYSTEM_PROMPT).to.include('from one Account to another');
    });

    it('should include CLI usage section with reference path', function () {
        const full = getBkperAgentSystemPrompt();
        expect(full).to.include('## Bkper CLI Usage');
        expect(full).to.include('cli-reference.md');
    });
});
