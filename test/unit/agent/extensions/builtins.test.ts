import {
    createExtensionRuntime,
    type Extension,
    type ExtensionAPI,
    type ProviderConfig,
} from '@earendil-works/pi-coding-agent';
import sinon from 'sinon';
import {expect} from '../../helpers/test-setup.js';
import {
    BKPER_AGENT_BUILTINS_EXTENSION_NAME,
    BKPER_AGENT_BUILTINS_EXTENSION_PATH,
    isBkperAgentVerboseDiagnosticsEnabled,
    normalizeBkperAgentExtensionErrors,
    normalizeBkperAgentExtensions,
    registerBkperAgentBuiltins,
} from '../../../../src/agent/extensions/builtins.js';

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

describe('Bkper agent built-in extensions', function () {
    it('registers built-in agent behavior through one internal entrypoint', function () {
        const registeredEvents: string[] = [];

        registerBkperAgentBuiltins({
            on: ((event: string) => {
                registeredEvents.push(event);
            }) as ExtensionAPI['on'],
            registerCommand: sinon.stub(),
            registerProvider: sinon.stub(),
        } as unknown as ExtensionAPI);

        expect(registeredEvents).to.deep.equal([
            'before_agent_start',
            'tool_call',
            'session_start',
            'session_start',
            'input',
            'tool_result',
            'session_start',
            'session_compact',
            'agent_settled',
        ]);
    });

    it('registers Bkper AI through Pi standard OpenAI Responses transport', function () {
        const providers: Array<{name: string; config: ProviderConfig}> = [];

        registerBkperAgentBuiltins(
            {
                on: sinon.stub() as unknown as ExtensionAPI['on'],
                registerCommand: sinon.stub(),
                registerProvider: (name: string, config: ProviderConfig) => {
                    providers.push({name, config});
                },
            } as unknown as ExtensionAPI,
            sinon.stub().resolves(),
            undefined,
            {}
        );

        expect(providers).to.have.length(1);
        expect(providers[0]?.name).to.equal('bkper');
        expect(providers[0]?.config.name).to.equal('Bkper AI');
        expect(providers[0]?.config.baseUrl).to.equal('https://ai.bkper.app/v1');
        expect(providers[0]?.config.apiKey).to.equal('!bkper auth token');
        expect(providers[0]?.config.authHeader).to.equal(true);
        expect(providers[0]?.config.api).to.equal('openai-responses');
        expect(providers[0]?.config.streamSimple).to.equal(undefined);
        expect(providers[0]?.config.headers).to.deep.equal({
            'bkper-ai-source': 'bkper-cli',
            'User-Agent': 'bkper-cli',
        });
        expect(providers[0]?.config.models).to.deep.equal([]);
        expect(providers[0]?.config.refreshModels).to.be.a('function');
    });

    it('allows a full Bkper AI path override on the development host', function () {
        const registerProvider = sinon.stub();

        registerBkperAgentBuiltins(
            {
                on: sinon.stub() as unknown as ExtensionAPI['on'],
                registerCommand: sinon.stub(),
                registerProvider,
            } as unknown as ExtensionAPI,
            sinon.stub().resolves(),
            undefined,
            {BKPER_AI_BASE_URL: 'https://ai-dev.bkper.app/experimental/v2'}
        );

        expect(registerProvider.firstCall.args[1].baseUrl).to.equal(
            'https://ai-dev.bkper.app/experimental/v2'
        );
    });

    for (const unsafeBaseUrl of [
        '',
        'not-a-url',
        'http://ai-dev.bkper.app/v2',
        'https://ai-dev.bkper.app.evil.example/v2',
        'https://user:password@ai-dev.bkper.app/v2',
        'https://ai-dev.bkper.app:8443/v2',
        'https://ai-dev.bkper.app/v2?target=other',
        'https://ai-dev.bkper.app/v2#fragment',
    ]) {
        it(`rejects unsafe Bkper AI override ${JSON.stringify(unsafeBaseUrl)}`, function () {
            expect(() =>
                registerBkperAgentBuiltins(
                    {
                        on: sinon.stub() as unknown as ExtensionAPI['on'],
                        registerCommand: sinon.stub(),
                        registerProvider: sinon.stub(),
                    } as unknown as ExtensionAPI,
                    sinon.stub().resolves(),
                    undefined,
                    {BKPER_AI_BASE_URL: unsafeBaseUrl}
                )
            ).to.throw(/BKPER_AI_BASE_URL/);
        });
    }

    it('gives built-in inline extensions a canonical startup display name', function () {
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

    it('shows the canonical built-in extension name in diagnostics', function () {
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

    it('enables verbose diagnostics through Bkper or Pi debug variables', function () {
        expect(isBkperAgentVerboseDiagnosticsEnabled({})).to.equal(false);
        expect(isBkperAgentVerboseDiagnosticsEnabled({BKPER_AGENT_DEBUG: '1'})).to.equal(true);
        expect(isBkperAgentVerboseDiagnosticsEnabled({PI_VERBOSE: '1'})).to.equal(true);
    });

    it('keeps internal inline extension details in verbose diagnostics', function () {
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
});
