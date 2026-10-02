import path from 'node:path';
import { createCodemodeExtension, type ExtensionAPI } from '@earendil-works/pi-coding-agent';
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

    it('lists codemode as an available tool when codemode is selected', function () {
        const full = getBkperAgentSystemPrompt(['read', 'bash', 'edit', 'write', 'codemode']);

        expect(full).to.include('- codemode:');
    });

    it("carries Pi's own codemode snippet and guidelines when codemode is selected", function () {
        let snippet: string | undefined;
        let guidelines: string[] = [];
        const registrar: Pick<ExtensionAPI, 'registerTool'> = {
            registerTool: tool => {
                snippet = tool.promptSnippet;
                guidelines = tool.promptGuidelines ?? [];
            },
        };
        createCodemodeExtension()(registrar as ExtensionAPI);

        const full = getBkperAgentSystemPrompt(['read', 'bash', 'edit', 'write', 'codemode']);

        expect(snippet).to.be.a('string').that.is.not.empty;
        expect(guidelines).to.not.be.empty;
        expect(full).to.include(`- codemode: ${snippet}`);
        for (const guideline of guidelines) {
            expect(full).to.include(`- ${guideline}`);
        }
    });

    it('steers judgments across many items to codemode classifiers when codemode is selected', function () {
        const full = getBkperAgentSystemPrompt(['read', 'bash', 'edit', 'write', 'codemode']);

        expect(full).to.include('models.classify(');
    });

    it('omits codemode guidance when codemode is not selected', function () {
        const full = getBkperAgentSystemPrompt(['read', 'bash', 'edit', 'write']);

        expect(full).to.not.include('codemode');
    });
});
