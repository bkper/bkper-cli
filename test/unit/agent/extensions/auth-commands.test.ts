import { expect, setupTestEnvironment } from '../../helpers/test-setup.js';
import {
    initTheme,
    LoginDialogComponent,
    type ExtensionAPI,
    type ExtensionCommandContext,
    type ExtensionUIContext,
    type KeybindingsManager,
    type Theme,
} from '@earendil-works/pi-coding-agent';
import type {TUI} from '@earendil-works/pi-tui';
import sinon from 'sinon';
import {
    BKPER_AGENT_LOGIN_COMMAND,
    BKPER_AGENT_LOGOUT_COMMAND,
    BKPER_AGENT_DISCONNECT_COMMAND,
    findStoredProvider,
    installBkperAuthCommandRouting,
    registerBkperAgentAuthExtension,
    selectAuthFallbackModel,
} from '../../../../src/agent/extensions/auth-commands.js';

function createLoginHarness() {
    initTheme('dark', false);
    const commands = new Map<string, {
        handler: (args: string, ctx: ExtensionCommandContext) => Promise<void>;
    }>();
    const authenticateBkper = sinon.stub().resolves({
        accessToken: 'private-access-token',
        email: 'user@example.com',
        alreadyLoggedIn: false,
    });
    const refresh = sinon.stub().resolves({aborted: false, errors: new Map<string, Error>()});
    const setModel = sinon.stub().resolves(true);
    const notify = sinon.stub();
    const openBrowser = sinon.stub();
    const model = {provider: 'bkper', id: 'test-model'};
    let dialog: LoginDialogComponent | undefined;
    const tui = {requestRender: sinon.stub()} as unknown as TUI;
    const custom: ExtensionUIContext['custom'] = (factory) => new Promise(resolve => {
        const component = factory(tui, {} as Theme, {} as KeybindingsManager, resolve);
        if (!(component instanceof LoginDialogComponent)) {
            throw new Error('Expected the Pi login dialog');
        }
        dialog = component;
    });
    const context = {
        mode: 'tui',
        model,
        modelRegistry: {refresh, getAvailable: () => [model]},
        ui: {custom, notify},
    } as unknown as ExtensionCommandContext;

    registerBkperAgentAuthExtension(
        {
            on: sinon.stub(),
            registerCommand: (
                name: string,
                options: {handler: (args: string, ctx: ExtensionCommandContext) => Promise<void>}
            ) => {
                commands.set(name, options);
            },
            setModel,
            setThinkingLevel: sinon.stub(),
        } as unknown as ExtensionAPI,
        {
            authenticateBkper,
            logoutBkper: sinon.stub(),
            isBkperLoggedIn: () => true,
            openBrowser,
        }
    );
    const command = commands.get(BKPER_AGENT_LOGIN_COMMAND);
    if (!command) throw new Error('Login command was not registered');
    return {
        run: () => command.handler('', context),
        authenticateBkper,
        refresh,
        setModel,
        notify,
        context,
        getDialog: () => dialog,
    };
}

describe('agent/auth-commands', function () {
    beforeEach(function () {
        setupTestEnvironment();
    });

    afterEach(function () {
        sinon.restore();
    });

    it('routes Bkper auth and external provider commands without preserving provider login aliases', async function () {
        const submitted: string[] = [];
        const editor = {
            onSubmit: async (text: string) => {
                submitted.push(text);
            },
        };
        const unregisterProvider = sinon.stub();
        const registerProvider = sinon.stub();

        installBkperAuthCommandRouting(editor, {
            unregisterProvider,
            registerProvider,
        });

        await editor.onSubmit('/login');
        await editor.onSubmit('/login openai');
        await editor.onSubmit('/logout');
        await editor.onSubmit('/connect openai');
        await editor.onSubmit('/disconnect anthropic');

        expect(submitted).to.deep.equal([
            `/${BKPER_AGENT_LOGIN_COMMAND}`,
            `/${BKPER_AGENT_LOGIN_COMMAND} openai`,
            `/${BKPER_AGENT_LOGOUT_COMMAND}`,
            '/login openai',
            `/${BKPER_AGENT_DISCONNECT_COMMAND} anthropic`,
        ]);
        expect(unregisterProvider.calledOnceWithExactly('bkper')).to.equal(true);
        expect(registerProvider.calledOnce).to.equal(true);
        expect(registerProvider.firstCall.args[0]).to.equal('bkper');
    });

    it('keeps Bkper suspended throughout the provider selector flow', async function () {
        const submitted: string[] = [];
        const editor = {
            onSubmit: async (text: string) => {
                submitted.push(text);
            },
        };
        const unregisterProvider = sinon.stub();
        const registerProvider = sinon.stub();

        installBkperAuthCommandRouting(editor, {
            unregisterProvider,
            registerProvider,
        });

        await editor.onSubmit('/connect');

        expect(submitted).to.deep.equal(['/login']);
        expect(unregisterProvider.calledOnceWithExactly('bkper')).to.equal(true);
        expect(registerProvider.called).to.equal(false);

        await editor.onSubmit('/model');

        expect(registerProvider.calledOnce).to.equal(true);
        expect(submitted).to.deep.equal(['/login', '/model']);
    });

    it('keeps Bkper out of provider connection flows', async function () {
        const submitted: string[] = [];
        const editor = {
            onSubmit: async (text: string) => {
                submitted.push(text);
            },
        };
        const unregisterProvider = sinon.stub();
        const registerProvider = sinon.stub();

        installBkperAuthCommandRouting(editor, {
            unregisterProvider,
            registerProvider,
        });

        await editor.onSubmit('/connect bkper');

        expect(submitted).to.deep.equal([`/${BKPER_AGENT_LOGIN_COMMAND} bkper`]);
        expect(unregisterProvider.called).to.equal(false);
        expect(registerProvider.called).to.equal(false);
    });

    it('matches stored providers by id or display name', function () {
        const providers = ['openai', 'anthropic'];
        const getDisplayName = (provider: string) =>
            provider === 'openai' ? 'OpenAI' : 'Anthropic';

        expect(findStoredProvider('OPENAI', providers, getDisplayName)).to.equal('openai');
        expect(findStoredProvider('anthropic', providers, getDisplayName)).to.equal('anthropic');
        expect(findStoredProvider('missing', providers, getDisplayName)).to.equal(undefined);
    });

    it('registers the Bkper auth commands and autocomplete behavior', function () {
        const commands = new Map<string, {handler: (args: string, ctx: ExtensionCommandContext) => Promise<void>}>();
        const events: string[] = [];
        const pi = {
            on: (event: string) => {
                events.push(event);
            },
            registerCommand: (
                name: string,
                options: {handler: (args: string, ctx: ExtensionCommandContext) => Promise<void>}
            ) => {
                commands.set(name, options);
            },
        } as unknown as ExtensionAPI;

        registerBkperAgentAuthExtension(pi);

        expect([...commands.keys()]).to.deep.equal([
            BKPER_AGENT_LOGIN_COMMAND,
            BKPER_AGENT_LOGOUT_COMMAND,
            BKPER_AGENT_DISCONNECT_COMMAND,
        ]);
        expect(events).to.deep.equal(['session_start']);
    });

    it('reports successful authentication after model setup', async function () {
        const login = createLoginHarness();
        await login.run();
        expect(login.refresh.calledOnce).to.equal(true);
        expect(login.notify.calledOnceWithExactly('Logged in to Bkper as user@example.com.', 'info')).to.equal(true);
    });

    it('reports an authentication failure without refreshing models', async function () {
        const login = createLoginHarness();
        login.authenticateBkper.rejects(new Error('OAuth unavailable'));
        await login.run();
        expect(login.refresh.called).to.equal(false);
        expect(login.notify.calledOnce).to.equal(true);
        expect(login.notify.firstCall.args[1]).to.equal('error');
        expect(login.notify.firstCall.args[0]).to.include('OAuth unavailable');
    });

    for (const stage of ['refresh rejection', 'reported catalog error', 'model selection'] as const) {
        it(`keeps authentication successful when ${stage} fails`, async function () {
            const login = createLoginHarness();
            const failure = new Error('Model service unavailable');
            if (stage === 'refresh rejection') {
                login.refresh.rejects(failure);
            } else if (stage === 'reported catalog error') {
                login.refresh.resolves({aborted: false, errors: new Map([['bkper', failure]])});
            } else {
                login.context.model = undefined;
                login.setModel.rejects(failure);
            }
            await login.run();
            expect(login.notify.calledWithExactly('Logged in to Bkper as user@example.com.', 'info')).to.equal(true);
            expect(login.notify.calledWithMatch(sinon.match(/model setup.*Model service unavailable/i), 'warning')).to.equal(true);
            expect(login.notify.args.some(([, severity]) => severity === 'error')).to.equal(false);
            expect(login.notify.args.flat().join(' ')).to.not.include('private-access-token');
        });
    }

    it('does not treat another provider catalog failure as a Bkper login failure', async function () {
        const login = createLoginHarness();
        login.refresh.resolves({
            aborted: false,
            errors: new Map([['other-provider', new Error('Unavailable')]]),
        });
        await login.run();
        expect(login.notify.calledOnce).to.equal(true);
        expect(login.notify.firstCall.args[1]).to.equal('info');
    });

    it('does not report login success after cancellation during model refresh', async function () {
        const login = createLoginHarness();
        login.refresh.callsFake(async () => {
            login.getDialog()?.handleInput('\u001b');
            throw new Error('Cancelled refresh');
        });
        await login.run();
        expect(login.notify.called).to.equal(false);
    });

    it('disconnects a stored provider and switches away from its active model', async function () {
        const commands = new Map<string, {handler: (args: string, ctx: ExtensionCommandContext) => Promise<void>}>();
        const setModel = sinon.stub().resolves(true);
        const pi = {
            on: sinon.stub(),
            registerCommand: (
                name: string,
                options: {handler: (args: string, ctx: ExtensionCommandContext) => Promise<void>}
            ) => {
                commands.set(name, options);
            },
            setModel,
        } as unknown as ExtensionAPI;
        const logoutProvider = sinon.stub().resolves();
        const listCredentials = sinon
            .stub()
            .resolves([{providerId: 'anthropic', type: 'oauth' as const}]);
        const refresh = sinon.stub().resolves();
        const notify = sinon.stub();
        const anthropic = {provider: 'anthropic', id: 'claude-sonnet-4'};
        const openai = {provider: 'openai', id: 'gpt-5'};
        const context = {
            model: anthropic,
            modelRegistry: {
                getProviderDisplayName: () => 'Anthropic',
                getProviderAuthStatus: () => ({configured: false}),
                getApiKeyForProvider: async () => undefined,
                getAvailable: () => [openai],
                refresh,
            },
            ui: {notify},
        } as unknown as ExtensionCommandContext;

        registerBkperAgentAuthExtension(
            pi,
            {
                authenticateBkper: sinon.stub(),
                logoutBkper: sinon.stub(),
                isBkperLoggedIn: () => false,
                openBrowser: sinon.stub(),
            },
            {listCredentials, logout: logoutProvider}
        );
        const command = commands.get(BKPER_AGENT_DISCONNECT_COMMAND);
        expect(command).to.not.equal(undefined);

        await command?.handler('anthropic', context);

        expect(logoutProvider.calledOnceWithExactly('anthropic')).to.equal(true);
        expect(refresh.calledOnce).to.equal(true);
        expect(setModel.calledOnceWithExactly(openai)).to.equal(true);
        expect(notify.calledWithExactly('Disconnected Anthropic.', 'info')).to.equal(true);
    });

    it('prefers the Bkper catalog default when authenticated', function () {
        const terra = {provider: 'bkper', id: 'openai/gpt-5.6-terra'};
        const luna = {
            provider: 'bkper',
            id: 'openai/gpt-5.6-luna',
            bkperDefault: true,
            bkperDefaultThinkingLevel: 'xhigh' as const,
        };
        const anthropic = {provider: 'anthropic', id: 'claude-sonnet-4'};
        const openai = {provider: 'openai', id: 'gpt-5'};
        const models = [anthropic, terra, luna, openai];

        expect(selectAuthFallbackModel(models, true, 'anthropic')).to.equal(luna);
        expect(selectAuthFallbackModel(models, false, 'anthropic')).to.equal(openai);
        expect(selectAuthFallbackModel([luna], false, 'anthropic')).to.equal(undefined);
    });
});
