import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
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

const REPO_ROOT = path.resolve(import.meta.dirname, '../../..');
const WORKSPACE_ROOT = path.dirname(REPO_ROOT);
const REVIEW_PROMPT = `review tax bot on ${WORKSPACE_ROOT}, check code and spot any inconsistency`;
const FIND_WORKSPACE_COMMAND = `find ${WORKSPACE_ROOT} -maxdepth 2`;

function registerPreloadExtension() {
    let beforeAgentStartHandler: RegisteredBeforeAgentStartHandler | undefined;
    let toolCallHandler: RegisteredToolCallHandler | undefined;

    registerBkperCoreConceptsPreloadExtension({
        on: ((event: string, handler: unknown) => {
            if (event === 'before_agent_start') {
                beforeAgentStartHandler = handler as RegisteredBeforeAgentStartHandler;
            }
            if (event === 'tool_call') {
                toolCallHandler = handler as RegisteredToolCallHandler;
            }
        }) as ExtensionAPI['on'],
    });

    expect(beforeAgentStartHandler).to.not.equal(undefined);
    expect(toolCallHandler).to.not.equal(undefined);

    return {
        beforeAgentStartHandler: beforeAgentStartHandler as RegisteredBeforeAgentStartHandler,
        toolCallHandler: toolCallHandler as RegisteredToolCallHandler,
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
                prompt: REVIEW_PROMPT,
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

    it('should resolve reference docs from source module directories', function () {
        const rootDir = mkdtempSync(path.join(tmpdir(), 'bkper-cli-source-'));
        const moduleDir = path.join(rootDir, 'src', 'agent');
        const referencesDir = path.join(rootDir, 'skill', 'references');
        const coreDir = path.join(referencesDir, 'core');
        mkdirSync(moduleDir, {recursive: true});
        mkdirSync(coreDir, {recursive: true});
        writeFileSync(path.join(coreDir, 'core-concepts.md'), '# Core Concepts');

        const docPath = resolveBkperDocPathFromModuleDir(moduleDir, 'core/core-concepts.md');

        expect(docPath).to.equal(path.join(coreDir, 'core-concepts.md'));
    });

    it('should resolve docs from built module directories', function () {
        const rootDir = mkdtempSync(path.join(tmpdir(), 'bkper-cli-built-'));
        const moduleDir = path.join(rootDir, 'lib', 'agent');
        const docsDir = path.join(rootDir, 'lib', 'docs');
        const coreDir = path.join(docsDir, 'core');
        mkdirSync(moduleDir, {recursive: true});
        mkdirSync(coreDir, {recursive: true});
        writeFileSync(path.join(coreDir, 'core-concepts.md'), '# Core Concepts');

        const docPath = resolveBkperDocPathFromModuleDir(moduleDir, 'core/core-concepts.md');

        expect(docPath).to.equal(path.join(coreDir, 'core-concepts.md'));
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
                prompt: REVIEW_PROMPT,
                systemPrompt: 'Base prompt',
            },
            {
                cwd: REPO_ROOT,
            }
        );

        expect(result).to.not.equal(undefined);
        expect(result?.systemPrompt).to.include('Base prompt');
        expect(result?.systemPrompt).to.include(getCoreConceptsDocPath());
        expect(result?.systemPrompt).to.include('Before doing anything else for this task');
    });

    it('should not block non-read tools while core concepts read is pending', async function () {
        const {beforeAgentStartHandler, toolCallHandler} = registerPreloadExtension();

        await beforeAgentStartHandler(
            {
                prompt: REVIEW_PROMPT,
                systemPrompt: 'Base prompt',
            },
            {
                cwd: REPO_ROOT,
            }
        );

        const result = await toolCallHandler(
            {
                toolName: 'bash',
                input: {command: FIND_WORKSPACE_COMMAND},
            },
            {
                cwd: REPO_ROOT,
            }
        );

        expect(result).to.equal(undefined);
    });

    it('should allow the canonical core concepts read and then allow other tools', async function () {
        const {beforeAgentStartHandler, toolCallHandler} = registerPreloadExtension();

        await beforeAgentStartHandler(
            {
                prompt: REVIEW_PROMPT,
                systemPrompt: 'Base prompt',
            },
            {
                cwd: REPO_ROOT,
            }
        );

        const readResult = await toolCallHandler(
            {
                toolName: 'read',
                input: {path: getCoreConceptsDocPath()},
            },
            {
                cwd: REPO_ROOT,
            }
        );

        const bashResult = await toolCallHandler(
            {
                toolName: 'bash',
                input: {command: FIND_WORKSPACE_COMMAND},
            },
            {
                cwd: REPO_ROOT,
            }
        );

        expect(readResult).to.equal(undefined);
        expect(bashResult).to.equal(undefined);
    });

    it('should require only the first successful read in the session', async function () {
        const {beforeAgentStartHandler, toolCallHandler} = registerPreloadExtension();

        await beforeAgentStartHandler(
            {
                prompt: REVIEW_PROMPT,
                systemPrompt: 'Base prompt',
            },
            {
                cwd: REPO_ROOT,
            }
        );

        await toolCallHandler(
            {
                toolName: 'read',
                input: {path: getCoreConceptsDocPath()},
            },
            {
                cwd: REPO_ROOT,
            }
        );

        const result = await beforeAgentStartHandler(
            {
                prompt: REVIEW_PROMPT,
                systemPrompt: 'Base prompt',
            },
            {
                cwd: REPO_ROOT,
            }
        );

        expect(result).to.equal(undefined);
    });

    it('should keep appending read instructions on relevant turns until core concepts are read', async function () {
        const {beforeAgentStartHandler} = registerPreloadExtension();

        await beforeAgentStartHandler(
            {
                prompt: REVIEW_PROMPT,
                systemPrompt: 'Base prompt',
            },
            {
                cwd: REPO_ROOT,
            }
        );

        const result = await beforeAgentStartHandler(
            {
                prompt: REVIEW_PROMPT,
                systemPrompt: 'Base prompt',
            },
            {
                cwd: REPO_ROOT,
            }
        );

        expect(result?.systemPrompt).to.include(getCoreConceptsDocPath());
    });
});
