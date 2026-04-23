import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { ExtensionAPI } from '@mariozechner/pi-coding-agent';
import { expect } from '../helpers/test-setup.js';
import {
    buildCoreConceptsReadInstruction,
    detectCoreConceptsPreloadLevel,
    getCoreConceptsDocPath,
    registerBkperCoreConceptsPreloadExtension,
    resolveBkperDocPathFromModuleDir,
    type CoreConceptsPreloadResult,
} from '../../../src/agent/core-concepts-preload.js';

type RegisteredBeforeAgentStartHandler = (
    event: {
        prompt: string;
        systemPrompt: string;
    },
    context: {
        cwd: string;
    }
) => Promise<CoreConceptsPreloadResult | void> | CoreConceptsPreloadResult | void;

type RegisteredToolCallHandler = (
    event: {
        toolName: string;
        input: Record<string, unknown>;
    },
    context: {
        cwd: string;
    }
) => Promise<{block: true; reason?: string} | void> | {block: true; reason?: string} | void;

type RegisteredAgentEndHandler = (
    event: unknown,
    context: {
        cwd: string;
    }
) => Promise<void> | void;

function registerPreloadExtension() {
    let beforeAgentStartHandler: RegisteredBeforeAgentStartHandler | undefined;
    let toolCallHandler: RegisteredToolCallHandler | undefined;
    let agentEndHandler: RegisteredAgentEndHandler | undefined;

    registerBkperCoreConceptsPreloadExtension({
        on: ((event: string, handler: unknown) => {
            if (event === 'before_agent_start') {
                beforeAgentStartHandler = handler as RegisteredBeforeAgentStartHandler;
            }
            if (event === 'tool_call') {
                toolCallHandler = handler as RegisteredToolCallHandler;
            }
            if (event === 'agent_end') {
                agentEndHandler = handler as RegisteredAgentEndHandler;
            }
        }) as ExtensionAPI['on'],
    });

    expect(beforeAgentStartHandler).to.not.equal(undefined);
    expect(toolCallHandler).to.not.equal(undefined);
    expect(agentEndHandler).to.not.equal(undefined);

    return {
        beforeAgentStartHandler: beforeAgentStartHandler as RegisteredBeforeAgentStartHandler,
        toolCallHandler: toolCallHandler as RegisteredToolCallHandler,
        agentEndHandler: agentEndHandler as RegisteredAgentEndHandler,
    };
}

describe('core concepts preload', function () {
    it('should classify bot documentation reviews as full preload tasks', function () {
        expect(
            detectCoreConceptsPreloadLevel({
                prompt: 'review the exchange bot documentation before we publish it',
            })
        ).to.equal('full');
    });

    it('should classify bot code reviews as full preload tasks', function () {
        expect(
            detectCoreConceptsPreloadLevel({
                prompt: 'review tax bot on /workspace, check code and spot any inconsistency',
            })
        ).to.equal('full');
    });

    it('should classify Bkper balance questions as full preload tasks', function () {
        expect(
            detectCoreConceptsPreloadLevel({
                prompt: 'show balances for asset and liability accounts',
            })
        ).to.equal('full');
    });

    it('should skip preload for generic README reviews without Bkper semantics', function () {
        expect(
            detectCoreConceptsPreloadLevel({
                prompt: 'review the README for clarity',
            })
        ).to.equal('none');
    });

    it('should resolve docs from source module directories', function () {
        const rootDir = mkdtempSync(path.join(tmpdir(), 'bkper-cli-source-'));
        const moduleDir = path.join(rootDir, 'src', 'agent');
        const docsDir = path.join(rootDir, 'docs');
        mkdirSync(moduleDir, {recursive: true});
        mkdirSync(docsDir, {recursive: true});
        writeFileSync(path.join(docsDir, 'core-concepts.md'), '# Core Concepts');

        const docPath = resolveBkperDocPathFromModuleDir(moduleDir, 'core-concepts.md');

        expect(docPath).to.equal(path.join(docsDir, 'core-concepts.md'));
    });

    it('should resolve docs from built module directories', function () {
        const rootDir = mkdtempSync(path.join(tmpdir(), 'bkper-cli-built-'));
        const moduleDir = path.join(rootDir, 'lib', 'agent');
        const docsDir = path.join(rootDir, 'lib', 'docs');
        mkdirSync(moduleDir, {recursive: true});
        mkdirSync(docsDir, {recursive: true});
        writeFileSync(path.join(docsDir, 'core-concepts.md'), '# Core Concepts');

        const docPath = resolveBkperDocPathFromModuleDir(moduleDir, 'core-concepts.md');

        expect(docPath).to.equal(path.join(docsDir, 'core-concepts.md'));
    });

    it('should build an explicit read-first instruction with the canonical doc path', function () {
        const instruction = buildCoreConceptsReadInstruction(getCoreConceptsDocPath());

        expect(instruction).to.include('Before doing anything else for this task');
        expect(instruction).to.include('use the `read` tool');
        expect(instruction).to.include(getCoreConceptsDocPath());
    });

    it('should append a read-first instruction before relevant turns', async function () {
        const {beforeAgentStartHandler} = registerPreloadExtension();

        const result = await beforeAgentStartHandler(
            {
                prompt: 'review tax bot on /workspace, check code and spot any inconsistency',
                systemPrompt: 'Base prompt',
            },
            {
                cwd: '/workspace/bkper-cli',
            }
        );

        expect(result).to.not.equal(undefined);
        expect(result?.systemPrompt).to.include('Base prompt');
        expect(result?.systemPrompt).to.include(getCoreConceptsDocPath());
        expect(result?.systemPrompt).to.include('Before doing anything else for this task');
    });

    it('should block non-read tools until core concepts are read', async function () {
        const {beforeAgentStartHandler, toolCallHandler} = registerPreloadExtension();

        await beforeAgentStartHandler(
            {
                prompt: 'review tax bot on /workspace, check code and spot any inconsistency',
                systemPrompt: 'Base prompt',
            },
            {
                cwd: '/workspace/bkper-cli',
            }
        );

        const result = await toolCallHandler(
            {
                toolName: 'bash',
                input: {command: 'find /workspace -maxdepth 2'},
            },
            {
                cwd: '/workspace/bkper-cli',
            }
        );

        expect(result).to.deep.equal({
            block: true,
            reason: `First use read on ${getCoreConceptsDocPath()} before other tools.`,
        });
    });

    it('should allow the canonical core concepts read and then allow other tools', async function () {
        const {beforeAgentStartHandler, toolCallHandler} = registerPreloadExtension();

        await beforeAgentStartHandler(
            {
                prompt: 'review tax bot on /workspace, check code and spot any inconsistency',
                systemPrompt: 'Base prompt',
            },
            {
                cwd: '/workspace/bkper-cli',
            }
        );

        const readResult = await toolCallHandler(
            {
                toolName: 'read',
                input: {path: getCoreConceptsDocPath()},
            },
            {
                cwd: '/workspace/bkper-cli',
            }
        );

        const bashResult = await toolCallHandler(
            {
                toolName: 'bash',
                input: {command: 'find /workspace -maxdepth 2'},
            },
            {
                cwd: '/workspace/bkper-cli',
            }
        );

        expect(readResult).to.equal(undefined);
        expect(bashResult).to.equal(undefined);
    });

    it('should require only the first successful read in the session', async function () {
        const {beforeAgentStartHandler, toolCallHandler} = registerPreloadExtension();

        await beforeAgentStartHandler(
            {
                prompt: 'review tax bot on /workspace, check code and spot any inconsistency',
                systemPrompt: 'Base prompt',
            },
            {
                cwd: '/workspace/bkper-cli',
            }
        );

        await toolCallHandler(
            {
                toolName: 'read',
                input: {path: getCoreConceptsDocPath()},
            },
            {
                cwd: '/workspace/bkper-cli',
            }
        );

        const result = await beforeAgentStartHandler(
            {
                prompt: 'review tax bot on /workspace, check code and spot any inconsistency',
                systemPrompt: 'Base prompt',
            },
            {
                cwd: '/workspace/bkper-cli',
            }
        );

        expect(result).to.equal(undefined);
    });

    it('should clear pending enforcement after the turn ends without contaminating the next unrelated turn', async function () {
        const {beforeAgentStartHandler, toolCallHandler, agentEndHandler} = registerPreloadExtension();

        await beforeAgentStartHandler(
            {
                prompt: 'review tax bot on /workspace, check code and spot any inconsistency',
                systemPrompt: 'Base prompt',
            },
            {
                cwd: '/workspace/bkper-cli',
            }
        );

        await agentEndHandler({}, {cwd: '/workspace/bkper-cli'});

        const result = await toolCallHandler(
            {
                toolName: 'bash',
                input: {command: 'pwd'},
            },
            {
                cwd: '/workspace/bkper-cli',
            }
        );

        expect(result).to.equal(undefined);
    });
});
