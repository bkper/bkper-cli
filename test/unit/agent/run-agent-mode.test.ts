import { expect } from '../helpers/test-setup.js';
import sinon from 'sinon';
import {
    createStartupSessionManager,
    registerBkperAgentStartupExtension,
    restorePersistedSessionOptions,
    runAgentMode,
    type AgentModeDependencies,
    type InteractiveRuntimeHost,
} from '../../../src/agent/run-agent-mode.js';

function createFakeRuntime(): InteractiveRuntimeHost {
    return Object.create(null) as unknown as InteractiveRuntimeHost;
}

describe('runAgentMode', function () {
    it('should register startup extension that shows ready message and starts maintenance once', async function () {
        let sessionStartHandler:
            | ((
                  event: unknown,
                  context: {
                      ui: {
                          notify: (message: string, type?: 'info' | 'warning' | 'error') => void;
                      };
                  }
              ) => Promise<void>)
            | undefined;

        const startupMaintenance = sinon.stub().resolves();
        const notify = sinon.stub();

        registerBkperAgentStartupExtension(
            {
                on: (
                    event: 'session_start',
                    handler: (
                        event: unknown,
                        context: {
                            ui: {
                                notify: (
                                    message: string,
                                    type?: 'info' | 'warning' | 'error'
                                ) => void;
                            };
                        }
                    ) => Promise<void>
                ) => {
                    if (event === 'session_start') {
                        sessionStartHandler = handler;
                    }
                },
            },
            startupMaintenance
        );

        expect(sessionStartHandler).to.not.equal(undefined);

        await sessionStartHandler?.({}, {ui: {notify}});
        await sessionStartHandler?.({}, {ui: {notify}});

        expect(notify.calledWithExactly('Bkper Agent ready.', 'info')).to.be.true;
        expect(startupMaintenance.calledOnce).to.be.true;
        expect(startupMaintenance.firstCall.args[0]).to.have.property('notify');
        expect(startupMaintenance.firstCall.args[0].notify).to.be.a('function');
    });

    it('should create startup session manager with sessionDir from settings', function () {
        const createSessionManager = sinon.stub().returns({id: 'session-manager'});

        const sessionManager = createStartupSessionManager(
            '/workspace/bkper-cli',
            {
                getSessionDir: () => '.pi/sessions',
            },
            createSessionManager
        );

        expect(createSessionManager.calledOnceWithExactly('/workspace/bkper-cli', '.pi/sessions'))
            .to.be.true;
        expect(sessionManager).to.equal(createSessionManager.firstCall.returnValue);
    });

    it('should restore persisted scoped models and reuse the saved default model when it is in scope', function () {
        const claude = {provider: 'anthropic', id: 'claude-sonnet-4'};
        const gemini = {provider: 'google', id: 'gemini-2.5-pro'};
        const models = [claude, gemini];

        const restored = restorePersistedSessionOptions(
            {
                getEnabledModels: () => [
                    'anthropic/claude-sonnet-4',
                    'google/gemini-2.5-pro',
                ],
                getDefaultProvider: () => 'google',
                getDefaultModel: () => 'gemini-2.5-pro',
            },
            {
                getAvailable: () => models,
                find: (provider: string, modelId: string) =>
                    models.find(model => model.provider === provider && model.id === modelId),
            },
            {
                buildSessionContext: () => ({messages: []}),
            }
        );

        expect(restored.scopedModels.map(({model}) => `${model.provider}/${model.id}`)).to.deep
            .equal(['anthropic/claude-sonnet-4', 'google/gemini-2.5-pro']);
        expect(restored.model).to.equal(gemini);
        expect(restored.thinkingLevel).to.equal(undefined);
        expect(restored.diagnostics).to.deep.equal([]);
    });

    it('should restore the first scoped model when the saved default model is outside scope', function () {
        const claude = {provider: 'anthropic', id: 'claude-sonnet-4'};
        const gemini = {provider: 'google', id: 'gemini-2.5-pro'};
        const models = [claude, gemini];

        const restored = restorePersistedSessionOptions(
            {
                getEnabledModels: () => ['anthropic/claude-sonnet-4:high', 'google/gemini-2.5-pro'],
                getDefaultProvider: () => 'openai',
                getDefaultModel: () => 'gpt-5',
            },
            {
                getAvailable: () => models,
                find: (provider: string, modelId: string) =>
                    models.find(model => model.provider === provider && model.id === modelId),
            },
            {
                buildSessionContext: () => ({messages: []}),
            }
        );

        expect(restored.model).to.equal(claude);
        expect(restored.thinkingLevel).to.equal('high');
        expect(restored.scopedModels[0]?.thinkingLevel).to.equal('high');
        expect(restored.scopedModels[1]?.thinkingLevel).to.equal(undefined);
    });

    it('should create runtime and run interactive mode', async function () {
        const calls: string[] = [];

        const fakeRuntime = createFakeRuntime();

        const deps: AgentModeDependencies = {
            createRuntime: async () => {
                calls.push('createRuntime');
                return {
                    runtime: fakeRuntime,
                };
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

    it('should report startup diagnostics before running interactive mode', async function () {
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

    it('should set PI_SKIP_VERSION_CHECK by default for embedded agent mode', async function () {
        const previous = process.env.PI_SKIP_VERSION_CHECK;
        delete process.env.PI_SKIP_VERSION_CHECK;

        const deps: AgentModeDependencies = {
            createRuntime: async () => ({
                runtime: createFakeRuntime(),
            }),
            createInteractiveMode: () => ({
                run: async () => {},
            }),
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

    it('should keep user-defined PI_SKIP_VERSION_CHECK value', async function () {
        const previous = process.env.PI_SKIP_VERSION_CHECK;
        process.env.PI_SKIP_VERSION_CHECK = '0';

        const deps: AgentModeDependencies = {
            createRuntime: async () => ({
                runtime: createFakeRuntime(),
            }),
            createInteractiveMode: () => ({
                run: async () => {},
            }),
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
