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
        expect(full).to.include(
            'Use PowerShell for file operations like listing, searching, and finding files. Use it to run bkper CLI commands when relevant.'
        );
    });
});
