import { expect } from '../helpers/test-setup.js';
import type { ExtensionAPI } from '@mariozechner/pi-coding-agent';
import sinon from 'sinon';
import { VERSION as PI_VERSION } from '@mariozechner/pi-coding-agent';
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

type NotificationType = 'info' | 'warning' | 'error';

type StartupTheme = {
    bold: (text: string) => string;
    fg: (color: string, text: string) => string;
};

type StartupHeaderFactory = (
    tui: unknown,
    theme: StartupTheme
) => {
    render: (width: number) => string[];
};

type RegisteredSessionStartHandler = (
    event: unknown,
    context: {
        ui: {
            notify: (message: string, type?: NotificationType) => void;
            setHeader: (factory: StartupHeaderFactory | undefined) => void;
        };
        modelRegistry: {
            getAvailable: () => Array<{
                provider: string;
                id: string;
            }>;
        };
    }
) => Promise<void>;

function createThemeStub(): StartupTheme {
    return {
        bold: (text: string) => text,
        fg: (_color: string, text: string) => text,
    };
}

function registerStartupExtension(
    startupMaintenance = sinon.stub().resolves(),
    settingsManager?: {
        getQuietStartup: () => boolean;
    }
): {
    sessionStartHandler: RegisteredSessionStartHandler;
    startupMaintenance: typeof startupMaintenance;
} {
    let sessionStartHandler: RegisteredSessionStartHandler | undefined;

    registerBkperAgentStartupExtension(
        {
            on: ((event: 'session_start', handler: RegisteredSessionStartHandler) => {
                if (event === 'session_start') {
                    sessionStartHandler = handler;
                }
            }) as unknown as ExtensionAPI['on'],
        },
        startupMaintenance,
        settingsManager
    );

    expect(sessionStartHandler).to.not.equal(undefined);

    return {
        sessionStartHandler: sessionStartHandler as RegisteredSessionStartHandler,
        startupMaintenance,
    };
}

describe('runAgentMode', function () {
    it('should replace the Pi startup header with basic Bkper hints and start maintenance once', async function () {
        const notify = sinon.stub();
        let startupHeaderFactory: StartupHeaderFactory | undefined;
        const setHeader = sinon
            .stub()
            .callsFake((factory: StartupHeaderFactory | undefined) => {
                startupHeaderFactory = factory;
            });

        const {sessionStartHandler, startupMaintenance} = registerStartupExtension();

        await sessionStartHandler(
            {},
            {
                ui: {notify, setHeader},
                modelRegistry: {
                    getAvailable: () => [{provider: 'anthropic', id: 'claude-sonnet-4'}],
                },
            }
        );
        await sessionStartHandler(
            {},
            {
                ui: {notify, setHeader},
                modelRegistry: {
                    getAvailable: () => [{provider: 'anthropic', id: 'claude-sonnet-4'}],
                },
            }
        );

        expect(setHeader.called).to.be.true;
        expect(startupHeaderFactory).to.not.equal(undefined);
        const headerText =
            startupHeaderFactory?.(undefined, createThemeStub()).render(120).join('\n') ?? '';

        expect(headerText).to.include('██████╗');
        expect(headerText).to.include(`pi v${PI_VERSION}`);
        expect(headerText).to.include('to interrupt');
        expect(headerText).to.include('for session tree');
        expect(headerText).to.include('to clear');
        expect(headerText).to.include('to exit');
        expect(headerText).to.include('for commands');
        expect(headerText).to.include('to run bash');
        expect(headerText).to.not.include('Pi can explain its own features and look up its docs.');
        expect(notify.called).to.be.false;
        expect(startupMaintenance.calledOnce).to.be.true;
        expect(startupMaintenance.firstCall.args[0]).to.have.property('notify');
        expect(startupMaintenance.firstCall.args[0].notify).to.be.a('function');
    });

    it('should suppress the header override when quietStartup is enabled', async function () {
        const notify = sinon.stub();
        const setHeader = sinon.stub();

        const {sessionStartHandler, startupMaintenance} = registerStartupExtension(
            sinon.stub().resolves(),
            {
                getQuietStartup: () => true,
            }
        );

        await sessionStartHandler(
            {},
            {
                ui: {notify, setHeader},
                modelRegistry: {
                    getAvailable: () => [],
                },
            }
        );

        expect(notify.called).to.be.false;
        expect(setHeader.called).to.be.false;
        expect(startupMaintenance.calledOnce).to.be.true;
    });

    it('should show a setup hint in the startup header when no models are available', async function () {
        const notify = sinon.stub();
        let startupHeaderFactory: StartupHeaderFactory | undefined;
        const setHeader = sinon
            .stub()
            .callsFake((factory: StartupHeaderFactory | undefined) => {
                startupHeaderFactory = factory;
            });

        const {sessionStartHandler} = registerStartupExtension();

        await sessionStartHandler(
            {},
            {
                ui: {notify, setHeader},
                modelRegistry: {
                    getAvailable: () => [],
                },
            }
        );

        expect(startupHeaderFactory).to.not.equal(undefined);
        const headerText =
            startupHeaderFactory?.(undefined, createThemeStub()).render(120).join('\n') ?? '';
        expect(headerText).to.include('██████╗');
        expect(headerText).to.include(`pi v${PI_VERSION}`);
        expect(headerText).to.include('to interrupt');
        expect(headerText).to.include('for session tree');
        expect(headerText).to.include('to clear');
        expect(headerText).to.include('to exit');
        expect(headerText).to.include('for commands');
        expect(headerText).to.include('to run bash');
        expect(headerText).to.include('No model provider configured. Use /login or add an API key.');
        expect(notify.called).to.be.false;
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
