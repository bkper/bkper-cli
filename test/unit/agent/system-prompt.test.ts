import path from 'node:path';
import { expect } from '../helpers/test-setup.js';
import { getBkperAgentSystemPrompt } from '../../../src/agent/system-prompt.js';

describe('agent system prompt', function () {
    it('should point source-mode reference docs at the canonical skill reference bundle', function () {
        const full = getBkperAgentSystemPrompt();

        expect(full).to.include(path.resolve('skill', 'references', 'index.md'));
        expect(full).to.include(path.resolve('skill', 'references'));
        expect(full).to.include(path.resolve('skill', 'references', 'core', 'core-concepts.md'));
    });

    it('should describe the selected PowerShell tool without adding the Pi prompt', function () {
        const full = getBkperAgentSystemPrompt([
            'read',
            'powershell',
            'edit',
            'write',
        ]);

        expect(full).to.match(/^# Bkper Context/);
        expect(full).to.include('- powershell: Execute PowerShell commands');
        expect(full).to.not.include('- bash:');
    });

    it('describes codemode and requires confirmation for Book writes in scripts when codemode is selected', function () {
        const full = getBkperAgentSystemPrompt(['read', 'bash', 'edit', 'write', 'codemode']);

        expect(full).to.include('- codemode:');
        expect(full).to.match(
            /codemode script that writes to a Book follows the same confirmation rule/
        );
    });

    it('omits codemode guidance when codemode is not selected', function () {
        const full = getBkperAgentSystemPrompt(['read', 'bash', 'edit', 'write']);

        expect(full).to.not.include('codemode');
    });
});
