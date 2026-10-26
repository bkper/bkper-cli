import {mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import sinon from 'sinon';
import {expect} from '../../helpers/test-setup.js';
import type {InteractiveRuntimeHost} from '../../../../src/agent/interactive/interactive-mode.js';
import {
    createAgentModeDependencies,
    runAgentMode,
    type AgentModeDependencies,
    type SessionOptions,
} from '../../../../src/agent/interactive/run-agent-mode.js';
import {AgentStartupError} from '../../../../src/agent/startup-error.js';

function createFakeRuntime(): InteractiveRuntimeHost {
    return Object.create(null) as unknown as InteractiveRuntimeHost;
}

type CreatedRuntime = Awaited<ReturnType<AgentModeDependencies['createRuntime']>>;

async function withRuntime(
    options: SessionOptions,
    check: (created: CreatedRuntime) => void
): Promise<void> {
    const previousAutoUpdate = process.env.BKPER_DISABLE_AUTOUPDATE;
    process.env.BKPER_DISABLE_AUTOUPDATE = '1';
    try {
        const created = await createAgentModeDependencies(options).createRuntime();
        try {
            check(created);
        } finally {
            await created.runtime.dispose();
        }
    } finally {
        if (previousAutoUpdate === undefined) {
            delete process.env.BKPER_DISABLE_AUTOUPDATE;
        } else {
            process.env.BKPER_DISABLE_AUTOUPDATE = previousAutoUpdate;
        }
    }
}

describe('runAgentMode with CLI session options', function () {
    let dir: string;

    beforeEach(function () {
        dir = mkdtempSync(path.join(tmpdir(), 'bkper-agent-mode-'));
    });

    afterEach(function () {
        rmSync(dir, {recursive: true, force: true});
    });

    it('opens the given session file', async function () {
        const sessionFile = path.join(dir, 'session.jsonl');
        writeFileSync(sessionFile, '');

        await withRuntime({sessionFile}, ({runtime}) => {
            expect(runtime.session.sessionFile).to.equal(sessionFile);
        });
    });

    it('limits the session and system prompt to the --tools list', async function () {
        await withRuntime({noSession: true, tools: ['read', 'bash']}, ({runtime}) => {
            expect(runtime.session.getActiveToolNames()).to.deep.equal(['read', 'bash']);
            expect(runtime.session.systemPrompt).to.include('- bash:');
            expect(runtime.session.systemPrompt).to.not.include('- codemode:');
        });
    });

    it('keeps Bkper Agent built-ins with --no-extensions', async function () {
        await withRuntime({noSession: true, noExtensions: true}, ({runtime}) => {
            expect(runtime.session.getActiveToolNames()).to.include('codemode');
        });
    });

    it('skips context files with --no-context-files', async function () {
        await withRuntime({noSession: true, noContextFiles: true}, ({runtime}) => {
            expect(runtime.services.resourceLoader.getAgentsFiles().agentsFiles).to.deep.equal(
                []
            );
        });
    });

    it('returns the initial prompt from messages', async function () {
        await withRuntime({noSession: true, messages: ['Task:\nReview']}, ({initialPrompt}) => {
            expect(initialPrompt).to.deep.equal({initialMessage: 'Task:\nReview'});
        });
    });

    it('returns the initial prompt with @file contents before the first message', async function () {
        const brief = path.join(dir, 'brief.md');
        writeFileSync(brief, 'Secret word: pelican');

        await withRuntime(
            {noSession: true, fileArgs: [brief], messages: ['Task', 'Next']},
            ({initialPrompt}) => {
                expect(initialPrompt).to.deep.equal({
                    initialMessage: `<file name="${brief}">\nSecret word: pelican\n</file>\nTask`,
                    initialMessages: ['Next'],
                });
            }
        );
    });

    it('refuses --provider without --model', async function () {
        let error: unknown;
        try {
            await withRuntime({noSession: true, provider: 'anthropic'}, () => {});
        } catch (caught) {
            error = caught;
        }

        expect(error).to.be.instanceOf(AgentStartupError);
        expect((error as Error).message).to.include('--provider requires --model');
    });

    it('refuses a --model from an unknown provider', async function () {
        let error: unknown;
        try {
            await withRuntime(
                {noSession: true, provider: 'no-such-provider', model: 'some-model'},
                () => {}
            );
        } catch (caught) {
            error = caught;
        }

        expect(error).to.be.instanceOf(AgentStartupError);
        expect((error as Error).message).to.include('no-such-provider');
    });

    it('starts with the --model and --thinking given', async function () {
        await withRuntime(
            {noSession: true, provider: 'anthropic', model: 'claude-opus-4-5', thinking: 'low'},
            ({runtime}) => {
                expect(runtime.session.model?.provider).to.equal('anthropic');
                expect(runtime.session.model?.id).to.equal('claude-opus-4-5');
                expect(runtime.session.thinkingLevel).to.equal('low');
            }
        );
    });
});

describe('runAgentMode', function () {
    it('starts interactive mode with the initial prompt', async function () {
        const createInteractiveMode = sinon.stub().returns({run: async () => {}});
        const initialPrompt = {initialMessage: 'hello', initialMessages: ['next']};

        await runAgentMode({
            createRuntime: async () => ({runtime: createFakeRuntime(), initialPrompt}),
            createInteractiveMode,
        });

        expect(createInteractiveMode.firstCall.args[2]).to.equal(initialPrompt);
    });

    it('fails runtime creation clearly for an unsafe Bkper AI override', async function () {
        const previousBaseUrl = process.env.BKPER_AI_BASE_URL;
        process.env.BKPER_AI_BASE_URL = 'https://attacker.example/v2';

        let startupError: unknown;
        try {
            await createAgentModeDependencies({noSession: true}).createRuntime();
        } catch (error) {
            startupError = error;
        } finally {
            if (previousBaseUrl === undefined) {
                delete process.env.BKPER_AI_BASE_URL;
            } else {
                process.env.BKPER_AI_BASE_URL = previousBaseUrl;
            }
        }

        expect(startupError).to.be.instanceOf(Error);
        expect((startupError as Error).message).to.include('BKPER_AI_BASE_URL');
    });

    it('applies forced PowerShell selection to runtime tools and prompt', async function () {
        const previousPlatform = process.env.BKPER_AGENT_FORCE_PLATFORM;
        const previousAutoUpdate = process.env.BKPER_DISABLE_AUTOUPDATE;
        process.env.BKPER_AGENT_FORCE_PLATFORM = 'win32';
        process.env.BKPER_DISABLE_AUTOUPDATE = '1';

        try {
            const {runtime} = await createAgentModeDependencies({
                noSession: true,
            }).createRuntime();

            try {
                expect(runtime.session.getActiveToolNames()).to.deep.equal([
                    'read',
                    'powershell',
                    'edit',
                    'write',
                    'codemode',
                ]);
                expect(runtime.session.systemPrompt).to.include(
                    '- powershell: Execute PowerShell commands'
                );
                expect(runtime.session.systemPrompt).to.include('- codemode:');
                expect(runtime.session.systemPrompt).to.not.include('- bash:');
            } finally {
                await runtime.dispose();
            }
        } finally {
            if (previousPlatform === undefined) {
                delete process.env.BKPER_AGENT_FORCE_PLATFORM;
            } else {
                process.env.BKPER_AGENT_FORCE_PLATFORM = previousPlatform;
            }
            if (previousAutoUpdate === undefined) {
                delete process.env.BKPER_DISABLE_AUTOUPDATE;
            } else {
                process.env.BKPER_DISABLE_AUTOUPDATE = previousAutoUpdate;
            }
        }
    });

    it('creates the runtime and runs interactive mode', async function () {
        const calls: string[] = [];
        const fakeRuntime = createFakeRuntime();
        const deps: AgentModeDependencies = {
            createRuntime: async () => {
                calls.push('createRuntime');
                return {runtime: fakeRuntime};
            },
            createInteractiveMode: (runtime, modelFallbackMessage) => {
                expect(runtime).to.equal(fakeRuntime);
                expect(modelFallbackMessage).to.equal(undefined);
                return {
                    run: async () => {
                        calls.push('run');
                    },
                };
            },
        };

        await runAgentMode(deps);

        expect(calls).to.deep.equal(['createRuntime', 'run']);
    });

    it('reports startup diagnostics before running interactive mode', async function () {
        const consoleError = sinon.stub(console, 'error');
        const calls: string[] = [];
        const fakeRuntime = createFakeRuntime();
        const deps: AgentModeDependencies = {
            createRuntime: async () => {
                calls.push('createRuntime');
                return {
                    runtime: fakeRuntime,
                    diagnostics: [
                        {
                            type: 'warning',
                            message: '(runtime creation, project settings) Invalid JSON',
                        },
                    ],
                };
            },
            createInteractiveMode: runtime => {
                expect(runtime).to.equal(fakeRuntime);
                return {
                    run: async () => {
                        calls.push('run');
                    },
                };
            },
        };

        try {
            await runAgentMode(deps);
        } finally {
            consoleError.restore();
        }

        expect(calls).to.deep.equal(['createRuntime', 'run']);
        expect(
            consoleError.calledWithExactly(
                'Warning: (runtime creation, project settings) Invalid JSON'
            )
        ).to.be.true;
    });

    it('sets PI_SKIP_VERSION_CHECK by default for embedded agent mode', async function () {
        const previous = process.env.PI_SKIP_VERSION_CHECK;
        delete process.env.PI_SKIP_VERSION_CHECK;

        const deps: AgentModeDependencies = {
            createRuntime: async () => ({runtime: createFakeRuntime()}),
            createInteractiveMode: () => ({run: async () => {}}),
        };

        try {
            await runAgentMode(deps);
            expect(process.env.PI_SKIP_VERSION_CHECK).to.equal('1');
        } finally {
            if (previous === undefined) {
                delete process.env.PI_SKIP_VERSION_CHECK;
            } else {
                process.env.PI_SKIP_VERSION_CHECK = previous;
            }
        }
    });

    it('keeps a user-defined PI_SKIP_VERSION_CHECK value', async function () {
        const previous = process.env.PI_SKIP_VERSION_CHECK;
        process.env.PI_SKIP_VERSION_CHECK = '0';

        const deps: AgentModeDependencies = {
            createRuntime: async () => ({runtime: createFakeRuntime()}),
            createInteractiveMode: () => ({run: async () => {}}),
        };

        try {
            await runAgentMode(deps);
            expect(process.env.PI_SKIP_VERSION_CHECK).to.equal('0');
        } finally {
            if (previous === undefined) {
                delete process.env.PI_SKIP_VERSION_CHECK;
            } else {
                process.env.PI_SKIP_VERSION_CHECK = previous;
            }
        }
    });
});
