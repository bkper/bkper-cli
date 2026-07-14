import { expect, setupTestEnvironment } from '../helpers/test-setup.js';
import type {
    ExtensionAPI,
    ExtensionCommandContext,
} from '@earendil-works/pi-coding-agent';
import sinon from 'sinon';
import {
    BKPER_AGENT_LOGIN_COMMAND,
    BKPER_AGENT_LOGOUT_COMMAND,
    BKPER_AGENT_DISCONNECT_COMMAND,
    findStoredProvider,
    installBkperAuthCommandRouting,
    registerBkperAgentAuthExtension,
    selectAuthFallbackModel,
} from '../../../src/agent/auth-commands.js';

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
        const logoutProvider = sinon.stub();
        const refresh = sinon.stub();
        const notify = sinon.stub();
        const anthropic = {provider: 'anthropic', id: 'claude-sonnet-4'};
        const openai = {provider: 'openai', id: 'gpt-5'};
        const context = {
            model: anthropic,
            modelRegistry: {
                authStorage: {
                    list: () => ['anthropic'],
                    get: () => ({type: 'oauth'}),
                    logout: logoutProvider,
                },
                getProviderDisplayName: () => 'Anthropic',
                getProviderAuthStatus: () => ({configured: false}),
                getApiKeyForProvider: async () => undefined,
                getAvailable: () => [openai],
                refresh,
            },
            ui: {notify},
        } as unknown as ExtensionCommandContext;

        registerBkperAgentAuthExtension(pi, {
            authenticateBkper: sinon.stub(),
            logoutBkper: sinon.stub(),
            isBkperLoggedIn: () => false,
            openBrowser: sinon.stub(),
        });
        const command = commands.get(BKPER_AGENT_DISCONNECT_COMMAND);
        expect(command).to.not.equal(undefined);

        await command?.handler('anthropic', context);

        expect(logoutProvider.calledOnceWithExactly('anthropic')).to.equal(true);
        expect(refresh.calledOnce).to.equal(true);
        expect(setModel.calledOnceWithExactly(openai)).to.equal(true);
        expect(notify.calledWithExactly('Disconnected Anthropic.', 'info')).to.equal(true);
    });

    it('prefers Bkper when authenticated and otherwise selects another provider', function () {
        const bkper = {provider: 'bkper', id: 'xai/grok-4.5'};
        const anthropic = {provider: 'anthropic', id: 'claude-sonnet-4'};
        const openai = {provider: 'openai', id: 'gpt-5'};
        const models = [anthropic, bkper, openai];

        expect(selectAuthFallbackModel(models, true, 'anthropic')).to.equal(bkper);
        expect(selectAuthFallbackModel(models, false, 'anthropic')).to.equal(openai);
        expect(selectAuthFallbackModel([bkper], false, 'anthropic')).to.equal(undefined);
    });
});
