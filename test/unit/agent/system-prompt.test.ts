import { expect } from '../helpers/test-setup.js';
import { BKPER_AGENT_SYSTEM_PROMPT, getBkperAgentSystemPrompt } from '../../../src/agent/system-prompt.js';

describe('agent system prompt', function () {
    it('should provide a non-empty prompt', function () {
        expect(BKPER_AGENT_SYSTEM_PROMPT.trim().length).to.be.greaterThan(0);
    });

    it('should contain the core identity instruction', function () {
        expect(BKPER_AGENT_SYSTEM_PROMPT).to.include('You are a Bkper team member');
    });

    it('should include the canonical core concepts content', function () {
        expect(BKPER_AGENT_SYSTEM_PROMPT).to.include('# Core Concepts');
        expect(BKPER_AGENT_SYSTEM_PROMPT).to.include('## Transactions');
        expect(BKPER_AGENT_SYSTEM_PROMPT).to.include('## Books');
    });

    it('should not include the duplicated core concepts canon heading', function () {
        expect(BKPER_AGENT_SYSTEM_PROMPT).to.not.include('## Core Concepts Canon');
    });

    it('should include CLI usage section with reference path', function () {
        const full = getBkperAgentSystemPrompt();
        expect(full).to.include('## Bkper CLI Usage');
        expect(full).to.include('cli-reference.md');
    });
});
