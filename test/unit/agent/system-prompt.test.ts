import { expect } from '../helpers/test-setup.js';
import { BKPER_AGENT_SYSTEM_PROMPT, getBkperAgentSystemPrompt } from '../../../src/agent/system-prompt.js';

describe('agent system prompt', function () {
    it('should provide a non-empty prompt', function () {
        expect(BKPER_AGENT_SYSTEM_PROMPT.trim().length).to.be.greaterThan(0);
    });

    it('should contain the core identity instruction', function () {
        expect(BKPER_AGENT_SYSTEM_PROMPT).to.include('You are a Bkper team member');
    });

    it('should not include a partial core concepts canon', function () {
        expect(BKPER_AGENT_SYSTEM_PROMPT).to.not.include('## Core Concepts Canon');
        expect(BKPER_AGENT_SYSTEM_PROMPT).to.not.include('## Critical Flow Reminders');
        expect(BKPER_AGENT_SYSTEM_PROMPT).to.not.include('Credit card purchase: `Credit Card >> Outgoing`');
    });

    it('should include concise loading rules for core concepts', function () {
        const full = getBkperAgentSystemPrompt();
        expect(full).to.include('If the task touches Bkper accounting semantics or data modeling');
        expect(full).to.include('Accounts, Transactions, balances, account types, groups, books');
        expect(full).to.include('mapping real-world flows into Bkper');
        expect(full).to.include('When in doubt, read first.');
        expect(full).to.include('core-concepts.md');
    });

    it('should not include remote documentation navigation or long enumerated loading rules', function () {
        const full = getBkperAgentSystemPrompt();
        expect(full).to.not.include('https://bkper.com/llms.txt');
        expect(full).to.not.include('credit cards, receivables, payables, or loans');
        expect(full).to.not.include('tax, inventory, portfolio, exchange, or subledger logic');
    });

    it('should not inline the full core concepts reference', function () {
        expect(BKPER_AGENT_SYSTEM_PROMPT).to.not.include('## Example Flows');
        expect(BKPER_AGENT_SYSTEM_PROMPT).to.not.include("These examples use Bkper's transaction shorthand `From >> To`");
    });

    it('should include CLI usage section with reference path', function () {
        const full = getBkperAgentSystemPrompt();
        expect(full).to.include('If the task involves using or executing `bkper` CLI commands');
        expect(full).to.include('cli-reference.md');
    });
});
