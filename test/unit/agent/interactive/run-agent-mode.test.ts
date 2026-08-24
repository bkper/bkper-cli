import sinon from 'sinon';
import {expect} from '../../helpers/test-setup.js';
import type {InteractiveRuntimeHost} from '../../../../src/agent/interactive/interactive-mode.js';
import {
    createAgentModeDependencies,
    runAgentMode,
    type AgentModeDependencies,
} from '../../../../src/agent/interactive/run-agent-mode.js';

function createFakeRuntime(): InteractiveRuntimeHost {
    return Object.create(null) as unknown as InteractiveRuntimeHost;
}

describe('runAgentMode', function () {
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
                ]);
                expect(runtime.session.systemPrompt).to.include(
                    '- powershell: Execute PowerShell commands'
                );
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
