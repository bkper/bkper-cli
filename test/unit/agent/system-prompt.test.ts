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

    it('should include the minimal tool guidance', function () {
        expect(BKPER_AGENT_SYSTEM_PROMPT).to.include('Available tools:');
        expect(BKPER_AGENT_SYSTEM_PROMPT).to.include('- read:');
        expect(BKPER_AGENT_SYSTEM_PROMPT).to.include('- bash:');
        expect(BKPER_AGENT_SYSTEM_PROMPT).to.match(/Use bash for .*discovery.*search/i);
        expect(BKPER_AGENT_SYSTEM_PROMPT).to.match(/bkper cli/i);
        expect(BKPER_AGENT_SYSTEM_PROMPT).to.match(/bkper cli.*relevant|relevant.*bkper cli/i);
        expect(BKPER_AGENT_SYSTEM_PROMPT).to.include(
            'Do not claim builds, tests, or command results unless you actually ran them.'
        );
    });

    it('should not include a partial core concepts canon', function () {
        expect(BKPER_AGENT_SYSTEM_PROMPT).to.not.include('## Core Concepts Canon');
        expect(BKPER_AGENT_SYSTEM_PROMPT).to.not.include('## Critical Flow Reminders');
        expect(BKPER_AGENT_SYSTEM_PROMPT).to.not.include('Credit card purchase: `Credit Card >> Outgoing`');
    });

    it('should include concise loading rules for core concepts', function () {
        const full = getBkperAgentSystemPrompt();
        expect(full).to.match(/If the task touches Bkper accounting semantics or data modeling/i);
        expect(full).to.match(/Accounts, Transactions, balances, account types, groups, books/i);
        expect(full).to.match(/mapping real-world flows into Bkper/i);
        expect(full).to.match(/When scope is unclear, inspect local files and project instructions first/i);
        expect(full).to.match(/core-concepts\.md/i);
    });

    it('should include Pi SDK routing when relevant', function () {
        const full = getBkperAgentSystemPrompt();
        expect(full).to.match(/If the task involves embedding or customizing the Pi agent or SDK/i);
        expect(full).to.match(/@mariozechner\/pi-coding-agent|AgentSessionRuntime|InteractiveMode/i);
        expect(full).to.include(
            'https://raw.githubusercontent.com/badlogic/pi-mono/refs/heads/main/packages/coding-agent/docs/sdk.md'
        );
        expect(full).to.match(/node_modules\/@mariozechner\/pi-coding-agent/i);
    });

    it('should keep Pi routing scoped to SDK guidance', function () {
        const full = getBkperAgentSystemPrompt();
        expect(full).to.not.match(/Pi documentation/i);
        expect(full).to.not.match(/themes, TUI/i);
    });

    it('should not inline the full core concepts reference', function () {
        expect(BKPER_AGENT_SYSTEM_PROMPT).to.not.include('## Example Flows');
        expect(BKPER_AGENT_SYSTEM_PROMPT).to.not.include("These examples use Bkper's transaction shorthand `From >> To`");
    });

    it('should include CLI usage section with reference path', function () {
        const full = getBkperAgentSystemPrompt();
        expect(full).to.match(/If the task involves using, generating, or executing `bkper` CLI commands/i);
        expect(full).to.match(/cli-reference\.md/i);
    });
});
