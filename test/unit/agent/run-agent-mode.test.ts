import path from 'node:path';
import { expect } from '../helpers/test-setup.js';
import {
    createExtensionRuntime,
    VERSION as PI_VERSION,
    type Extension,
    type ExtensionAPI,
    type ProviderConfig,
} from '@earendil-works/pi-coding-agent';
import { getKeybindings, KeybindingsManager, setKeybindings } from '@earendil-works/pi-tui';
import sinon from 'sinon';
import {
    applyBkperSessionKeybindings,
    BKPER_AGENT_BUILTINS_EXTENSION_NAME,
    BKPER_AGENT_BUILTINS_EXTENSION_PATH,
    BkperInteractiveMode,
    createStartupSessionManager,
    installBkperSessionKeybindings,
    isBkperAgentVerboseDiagnosticsEnabled,
    normalizeBkperAgentExtensionErrors,
    normalizeBkperAgentExtensions,
    registerBkperAgentBuiltins,
    registerBkperAgentStartupExtension,
    restorePersistedSessionOptions,
    runAgentMode,
    suppressPiResumeHintOutput,
    type AgentModeDependencies,
    type InteractiveRuntimeHost,
} from '../../../src/agent/run-agent-mode.js';

const REPO_ROOT = path.resolve(import.meta.dirname, '../../..');

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

const STARTUP_TEST_KEYBINDINGS = {
    'app.interrupt': {defaultKeys: 'escape'},
    'app.clear': {defaultKeys: 'ctrl+c'},
    'app.session.resume': {defaultKeys: 'ctrl+s'},
    'app.session.fork': {defaultKeys: 'ctrl+x'},
    'app.session.tree': {defaultKeys: 'ctrl+r'},
} as const;

function renderStartupHeaderWithKeybindings(factory: StartupHeaderFactory): string {
    const previousKeybindings = getKeybindings();
    setKeybindings(new KeybindingsManager(STARTUP_TEST_KEYBINDINGS));

    try {
        return factory(undefined, createThemeStub()).render(120).join('\n');
    } finally {
        setKeybindings(previousKeybindings);
    }
}

function createLoadedExtension(extensionPath: string): Extension {
    return {
        path: extensionPath,
        resolvedPath: extensionPath,
        sourceInfo: {
            path: extensionPath,
            source: extensionPath.startsWith('<inline:') ? 'inline' : 'local',
            scope: 'temporary',
            origin: 'top-level',
        },
        handlers: new Map(),
        tools: new Map(),
        messageRenderers: new Map(),
        commands: new Map(),
        flags: new Map(),
        shortcuts: new Map(),
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
    it('should register Bkper built-in agent behavior through one internal extension entrypoint', function () {
        const registeredEvents: string[] = [];

        registerBkperAgentBuiltins({
            on: ((event: string) => {
                registeredEvents.push(event);
            }) as ExtensionAPI['on'],
            registerProvider: sinon.stub(),
        } as unknown as ExtensionAPI);

        expect(registeredEvents).to.deep.equal([
            'before_agent_start',
            'tool_call',
            'session_start',
        ]);
    });

    it('should register Bkper AI as a built-in OpenAI-compatible provider', function () {
        const providers: Array<{name: string; config: ProviderConfig}> = [];

        registerBkperAgentBuiltins({
            on: sinon.stub() as unknown as ExtensionAPI['on'],
            registerProvider: (name: string, config: ProviderConfig) => {
                providers.push({name, config});
            },
        } as unknown as ExtensionAPI);

        expect(providers).to.have.length(1);
        expect(providers[0]?.name).to.equal('bkper');
        expect(providers[0]?.config.name).to.equal('Bkper AI');
        expect(providers[0]?.config.baseUrl).to.equal('https://ai.bkper.app/v1');
        expect(providers[0]?.config.apiKey).to.equal('!bkper auth token');
        expect(providers[0]?.config.authHeader).to.equal(true);
        expect(providers[0]?.config.models?.map(model => model.id)).to.deep.equal([
            '@cf/moonshotai/kimi-k2.7-code',
            '@cf/zai-org/glm-5.2',
        ]);
        expect(providers[0]?.config.models?.map(model => model.name)).to.deep.equal([
            'Kimi K2.7 Code',
            'GLM 5.2',
        ]);
    });

    it('should give Bkper built-in inline extensions a canonical startup display name', function () {
        const normalized = normalizeBkperAgentExtensions(
            {
                extensions: [
                    createLoadedExtension('<inline:1>'),
                    createLoadedExtension('/tmp/user-extension.ts'),
                ],
                errors: [],
                runtime: createExtensionRuntime(),
            },
            {verbose: false}
        );

        expect(normalized.extensions.map(extension => extension.path)).to.deep.equal([
            BKPER_AGENT_BUILTINS_EXTENSION_PATH,
            '/tmp/user-extension.ts',
        ]);
        expect(normalized.extensions[0]?.path).to.include('bkper-agent-builtins');
        expect(normalized.extensions[0]?.resolvedPath).to.equal(
            BKPER_AGENT_BUILTINS_EXTENSION_PATH
        );
        expect(normalized.extensions[0]?.sourceInfo.path).to.equal(
            BKPER_AGENT_BUILTINS_EXTENSION_PATH
        );
    });

    it('should show the canonical Bkper built-in extension name in diagnostics', function () {
        const normalized = normalizeBkperAgentExtensionErrors(
            [
                {path: '<inline:1>', error: 'Failed to load extension: boom'},
                {path: '/tmp/user-extension.ts', error: 'Failed to load extension: user boom'},
            ],
            {verbose: false}
        );

        expect(normalized).to.deep.equal([
            {
                path: BKPER_AGENT_BUILTINS_EXTENSION_PATH,
                error: `${BKPER_AGENT_BUILTINS_EXTENSION_NAME} failed to start.`,
            },
            {path: '/tmp/user-extension.ts', error: 'Failed to load extension: user boom'},
        ]);
    });

    it('should enable verbose diagnostics through Bkper or Pi debug environment variables', function () {
        expect(isBkperAgentVerboseDiagnosticsEnabled({})).to.equal(false);
        expect(isBkperAgentVerboseDiagnosticsEnabled({BKPER_AGENT_DEBUG: '1'})).to.equal(true);
        expect(isBkperAgentVerboseDiagnosticsEnabled({PI_VERBOSE: '1'})).to.equal(true);
    });

    it('should keep internal inline extension details in verbose diagnostics', function () {
        const normalized = normalizeBkperAgentExtensionErrors(
            [{path: '<inline:1>', error: 'Failed to load extension: boom'}],
            {verbose: true}
        );

        expect(normalized).to.deep.equal([
            {
                path: BKPER_AGENT_BUILTINS_EXTENSION_PATH,
                error: `${BKPER_AGENT_BUILTINS_EXTENSION_NAME} failed to start.\nDetails: <inline:1> Failed to load extension: boom`,
            },
        ]);
    });

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
        const headerText = startupHeaderFactory
            ? renderStartupHeaderWithKeybindings(startupHeaderFactory)
            : '';

        expect(headerText).to.include('██████╗');
        expect(headerText).to.include(`pi v${PI_VERSION}`);
        expect(headerText).to.include('to interrupt');
        expect(headerText).to.include('for session tree');
        expect(headerText).to.include('to clear');
        expect(headerText).to.include('to exit');
        expect(headerText).to.include('for commands');
        expect(headerText).to.include('to run bash');
        expect(headerText).to.include('/resume (ctrl+s)');
        expect(headerText).to.include('to resume a session');
        expect(headerText).to.include('/fork (ctrl+x)');
        expect(headerText).to.include('to branch from a message');
        expect(headerText).to.include('/clone');
        expect(headerText).to.include('to duplicate session');
        expect(headerText).to.include('/tree (ctrl+r)');
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
        const headerText = startupHeaderFactory
            ? renderStartupHeaderWithKeybindings(startupHeaderFactory)
            : '';
        expect(headerText).to.include('██████╗');
        expect(headerText).to.include(`pi v${PI_VERSION}`);
        expect(headerText).to.include('to interrupt');
        expect(headerText).to.include('for session tree');
        expect(headerText).to.include('to clear');
        expect(headerText).to.include('to exit');
        expect(headerText).to.include('for commands');
        expect(headerText).to.include('to run bash');
        expect(headerText).to.include('/resume (ctrl+s)');
        expect(headerText).to.include('to resume a session');
        expect(headerText).to.include('/fork (ctrl+x)');
        expect(headerText).to.include('to branch from a message');
        expect(headerText).to.include('/clone');
        expect(headerText).to.include('to duplicate session');
        expect(headerText).to.include('/tree (ctrl+r)');
        expect(headerText).to.include('Run bkper auth login to use Bkper AI');
        expect(notify.called).to.be.false;
    });

    it('should add Bkper session keybindings without overwriting user bindings', function () {
        let userBindings: Record<string, string | string[] | undefined> = {
            'app.session.resume': 'ctrl+q',
            'app.session.tree': [],
        };
        const keybindings = {
            getUserBindings: () => userBindings,
            setUserBindings: (nextBindings: Record<string, string | string[] | undefined>) => {
                userBindings = nextBindings;
            },
        };

        applyBkperSessionKeybindings(keybindings);

        expect(userBindings).to.deep.equal({
            'app.session.resume': 'ctrl+q',
            'app.session.tree': [],
            'app.session.fork': 'ctrl+x',
        });
    });

    it('should skip Bkper session shortcuts claimed by user bindings', function () {
        let userBindings: Record<string, string | string[] | undefined> = {
            'tui.editor.cursorRight': 'ctrl+x',
        };
        const keybindings = {
            getUserBindings: () => userBindings,
            setUserBindings: (nextBindings: Record<string, string | string[] | undefined>) => {
                userBindings = nextBindings;
            },
        };

        applyBkperSessionKeybindings(keybindings);

        expect(userBindings).to.deep.equal({
            'tui.editor.cursorRight': 'ctrl+x',
            'app.session.resume': 'ctrl+s',
            'app.session.tree': 'ctrl+r',
        });
    });

    it('should reapply Bkper session keybindings after keybindings reload', function () {
        let userBindings: Record<string, string | string[] | undefined> = {};
        const keybindings = {
            getUserBindings: () => userBindings,
            setUserBindings: (nextBindings: Record<string, string | string[] | undefined>) => {
                userBindings = nextBindings;
            },
            reload: sinon.stub().callsFake(() => {
                userBindings = {};
            }),
        };

        installBkperSessionKeybindings(keybindings);
        keybindings.reload();

        expect(userBindings).to.deep.equal({
            'app.session.resume': 'ctrl+s',
            'app.session.tree': 'ctrl+r',
            'app.session.fork': 'ctrl+x',
        });
    });

    it('should create startup session manager with sessionDir from settings', function () {
        const createSessionManager = sinon.stub().returns({id: 'session-manager'});

        const sessionManager = createStartupSessionManager(
            REPO_ROOT,
            {
                getSessionDir: () => '.pi/sessions',
            },
            createSessionManager
        );

        expect(createSessionManager.calledOnceWithExactly(REPO_ROOT, '.pi/sessions')).to.be.true;
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

    it('should suppress the pi changelog banner in BkperInteractiveMode', async function () {
        const mode: Record<string, unknown> = {};

        try {
            await BkperInteractiveMode.prototype.init.call(mode);
        } catch {
            // expected — mode lacks InteractiveMode internals
        }

        expect(typeof mode.getChangelogForDisplay).to.equal('function');
        expect((mode.getChangelogForDisplay as () => unknown)()).to.equal(undefined);
    });

    it('should suppress the Pi exit resume hint', function () {
        const originalWrite = process.stdout.write;
        const writes: string[] = [];
        const fakeWrite = ((chunk: string | Uint8Array) => {
            writes.push(String(chunk));
            return true;
        }) as typeof process.stdout.write;

        process.stdout.write = fakeWrite;
        const restore = suppressPiResumeHintOutput();

        try {
            process.stdout.write('\x1B[2mTo resume this session:\x1B[22m pi --session abc123\n');
            process.stdout.write('rendered chat mentions To resume this session: as text\n');
            process.stdout.write('other output\n');
        } finally {
            restore();
            process.stdout.write = originalWrite;
        }

        expect(writes).to.deep.equal([
            'rendered chat mentions To resume this session: as text\n',
            'other output\n',
        ]);
    });
});
