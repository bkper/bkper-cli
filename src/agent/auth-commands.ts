import {spawn} from 'node:child_process';
import {
    LoginDialogComponent,
    type ExtensionAPI,
    type ExtensionCommandContext,
    type ProviderConfig,
} from '@earendil-works/pi-coding-agent';
import type {
    AutocompleteItem,
    AutocompleteProvider,
    AutocompleteSuggestions,
} from '@earendil-works/pi-tui';
import {
    authenticateBkper,
    isLoggedIn,
    logoutBkper,
    type BkperAuthenticationResult,
    type BkperLogoutResult,
    type OAuthInteractionOptions,
} from '../auth/local-auth-service.js';
import {
    BKPER_AI_PROVIDER_ID,
    BKPER_AI_STARTUP_DEFAULT_MODEL_ID,
    getBkperAiProviderConfig,
} from './bkper-ai-provider.js';

export const BKPER_AGENT_LOGIN_COMMAND = 'bkper-agent-login';
export const BKPER_AGENT_LOGOUT_COMMAND = 'bkper-agent-logout';
export const BKPER_AGENT_DISCONNECT_COMMAND = 'bkper-agent-disconnect';

interface AuthCommandEditor {
    onSubmit?: (text: string) => void | Promise<void>;
}

interface ProviderRegistry {
    unregisterProvider(name: string): void;
    registerProvider(name: string, config: ProviderConfig): void;
}

interface ModelLike {
    provider: string;
    id: string;
}

function parseCommand(text: string): {command: string; args: string} | undefined {
    const match = /^\/(\S+)(?:\s+(.*))?$/.exec(text.trim());
    if (!match?.[1]) {
        return undefined;
    }
    return {
        command: match[1],
        args: match[2]?.trim() ?? '',
    };
}

function isBkperProviderReference(providerRef: string): boolean {
    const normalized = providerRef.trim().toLowerCase();
    return normalized === BKPER_AI_PROVIDER_ID || normalized === 'bkper ai';
}

export function installBkperAuthCommandRouting(
    editor: AuthCommandEditor,
    modelRegistry: ProviderRegistry
): void {
    const submit = editor.onSubmit;
    if (!submit) {
        return;
    }

    let bkperProviderSuspended = false;
    const restoreBkperProvider = () => {
        if (!bkperProviderSuspended) {
            return;
        }
        modelRegistry.registerProvider(BKPER_AI_PROVIDER_ID, getBkperAiProviderConfig());
        bkperProviderSuspended = false;
    };

    editor.onSubmit = async (text: string) => {
        restoreBkperProvider();
        const parsed = parseCommand(text);
        if (!parsed) {
            await submit(text);
            return;
        }

        if (parsed.command === 'login') {
            const suffix = parsed.args ? ` ${parsed.args}` : '';
            await submit(`/${BKPER_AGENT_LOGIN_COMMAND}${suffix}`);
            return;
        }

        if (parsed.command === 'logout') {
            const suffix = parsed.args ? ` ${parsed.args}` : '';
            await submit(`/${BKPER_AGENT_LOGOUT_COMMAND}${suffix}`);
            return;
        }

        if (parsed.command === 'disconnect') {
            const suffix = parsed.args ? ` ${parsed.args}` : '';
            await submit(`/${BKPER_AGENT_DISCONNECT_COMMAND}${suffix}`);
            return;
        }

        if (parsed.command !== 'connect') {
            await submit(text);
            return;
        }

        if (parsed.args && isBkperProviderReference(parsed.args)) {
            await submit(`/${BKPER_AGENT_LOGIN_COMMAND} ${parsed.args}`);
            return;
        }

        modelRegistry.unregisterProvider(BKPER_AI_PROVIDER_ID);
        if (!parsed.args) {
            bkperProviderSuspended = true;
            try {
                await submit('/login');
            } catch (error) {
                restoreBkperProvider();
                throw error;
            }
            return;
        }

        try {
            await submit(`/login ${parsed.args}`);
        } finally {
            modelRegistry.registerProvider(BKPER_AI_PROVIDER_ID, getBkperAiProviderConfig());
        }
    };
}

export function findStoredProvider(
    providerRef: string,
    storedProviders: string[],
    getDisplayName: (provider: string) => string
): string | undefined {
    const normalized = providerRef.trim().toLowerCase();
    return storedProviders.find(
        provider =>
            provider.toLowerCase() === normalized ||
            getDisplayName(provider).toLowerCase() === normalized
    );
}

export function selectAuthFallbackModel<TModel extends ModelLike>(
    availableModels: TModel[],
    bkperLoggedIn: boolean,
    excludedProvider?: string
): TModel | undefined {
    const candidates = availableModels.filter(model => model.provider !== excludedProvider);

    if (bkperLoggedIn) {
        const defaultBkperModel = candidates.find(
            model =>
                model.provider === BKPER_AI_PROVIDER_ID &&
                model.id === BKPER_AI_STARTUP_DEFAULT_MODEL_ID
        );
        if (defaultBkperModel) {
            return defaultBkperModel;
        }
    }

    return candidates.find(model => model.provider !== BKPER_AI_PROVIDER_ID);
}

export interface BkperAuthCommandDependencies {
    authenticateBkper(
        options?: OAuthInteractionOptions
    ): Promise<BkperAuthenticationResult>;
    logoutBkper(): Promise<BkperLogoutResult>;
    isBkperLoggedIn(): boolean;
    openBrowser(url: string): void;
}

const defaultAuthCommandDependencies: BkperAuthCommandDependencies = {
    authenticateBkper,
    logoutBkper,
    isBkperLoggedIn: isLoggedIn,
    openBrowser: openBrowserUrl,
};

function openBrowserUrl(url: string): void {
    const command =
        process.platform === 'darwin'
            ? {file: 'open', args: [url]}
            : process.platform === 'win32'
            ? {file: 'cmd', args: ['/c', 'start', '', url]}
            : {file: 'xdg-open', args: [url]};

    try {
        const child = spawn(command.file, command.args, {
            detached: true,
            stdio: 'ignore',
        });
        child.on('error', () => {});
        child.unref();
    } catch {
        // The login panel retains a clickable URL when no local browser is available.
    }
}

async function switchToAuthFallback(
    pi: ExtensionAPI,
    ctx: ExtensionCommandContext,
    dependencies: BkperAuthCommandDependencies,
    excludedProvider?: string
): Promise<boolean> {
    const fallback = selectAuthFallbackModel(
        ctx.modelRegistry.getAvailable(),
        dependencies.isBkperLoggedIn(),
        excludedProvider
    );
    if (!fallback) {
        return false;
    }

    const changed = await pi.setModel(fallback);
    if (
        changed &&
        fallback.provider === BKPER_AI_PROVIDER_ID &&
        fallback.id === BKPER_AI_STARTUP_DEFAULT_MODEL_ID
    ) {
        pi.setThinkingLevel('high');
    }
    return changed;
}

async function handleBkperLogin(
    args: string,
    pi: ExtensionAPI,
    ctx: ExtensionCommandContext,
    dependencies: BkperAuthCommandDependencies
): Promise<void> {
    if (args.trim()) {
        ctx.ui.notify(
            'Use /login without arguments for Bkper. Use /connect <provider> for other models.',
            'warning'
        );
        return;
    }
    if (ctx.mode !== 'tui') {
        ctx.ui.notify('Run bkper auth login to log in to Bkper.', 'warning');
        return;
    }

    await ctx.ui.custom<undefined>((tui, _theme, _keybindings, done) => {
        let completed = false;
        const finish = () => {
            if (completed) {
                return;
            }
            completed = true;
            done(undefined);
        };
        const dialog = new LoginDialogComponent(
            tui,
            BKPER_AI_PROVIDER_ID,
            () => finish(),
            'Bkper',
            'Login to Bkper'
        );
        dialog.showProgress('Checking Bkper authentication...');

        void dependencies
            .authenticateBkper({
                signal: dialog.signal,
                onStatus: message => dialog.showProgress(message),
                onDeviceCode: info => {
                    dialog.showDeviceCode({
                        userCode: info.userCode,
                        verificationUri: info.verificationUrl,
                        expiresInSeconds: info.expiresIn,
                        intervalSeconds: info.interval,
                    });
                    dialog.showWaiting('Waiting for Bkper authorization...');
                    dependencies.openBrowser(info.verificationUrl);
                },
            })
            .then(async result => {
                if (dialog.signal.aborted) {
                    return;
                }
                ctx.modelRegistry.refresh();
                const currentModel = ctx.model;
                const currentModelAvailable = currentModel
                    ? ctx.modelRegistry
                          .getAvailable()
                          .some(
                              model =>
                                  model.provider === currentModel.provider &&
                                  model.id === currentModel.id
                          )
                    : false;
                if (!currentModelAvailable) {
                    await switchToAuthFallback(pi, ctx, dependencies);
                }
                const state = result.alreadyLoggedIn ? 'Already logged in' : 'Logged in';
                const identity = result.email ? ` as ${result.email}` : '';
                finish();
                ctx.ui.notify(`${state} to Bkper${identity}.`, 'info');
            })
            .catch(error => {
                if (dialog.signal.aborted) {
                    return;
                }
                finish();
                const message = error instanceof Error ? error.message : String(error);
                ctx.ui.notify(`Bkper login failed: ${message}`, 'error');
            });

        return dialog;
    });
}

async function handleBkperLogout(
    args: string,
    pi: ExtensionAPI,
    ctx: ExtensionCommandContext,
    dependencies: BkperAuthCommandDependencies
): Promise<void> {
    if (args.trim()) {
        ctx.ui.notify(
            'Use /logout without arguments for Bkper. Use /disconnect <provider> for other models.',
            'warning'
        );
        return;
    }

    const result = await dependencies.logoutBkper();
    ctx.modelRegistry.refresh();
    const switched =
        ctx.model?.provider === BKPER_AI_PROVIDER_ID
            ? await switchToAuthFallback(pi, ctx, dependencies, BKPER_AI_PROVIDER_ID)
            : true;

    if (result.warning) {
        ctx.ui.notify(`Logged out of Bkper locally. ${result.warning}`, 'warning');
        return;
    }
    const guidance = switched ? '' : ' Use /login or /connect to continue.';
    ctx.ui.notify(`Logged out of Bkper.${guidance}`, 'info');
}

async function resolveProviderToDisconnect(
    providerRef: string,
    ctx: ExtensionCommandContext
): Promise<string | undefined> {
    const storedProviders = ctx.modelRegistry.authStorage
        .list()
        .filter(provider => provider !== BKPER_AI_PROVIDER_ID);
    if (providerRef.trim()) {
        return findStoredProvider(
            providerRef,
            storedProviders,
            provider => ctx.modelRegistry.getProviderDisplayName(provider)
        );
    }
    if (storedProviders.length === 0) {
        return undefined;
    }

    const labels = storedProviders.map(provider => {
        const name = ctx.modelRegistry.getProviderDisplayName(provider);
        return name === provider ? provider : `${name} (${provider})`;
    });
    const selected = await ctx.ui.select('Select model provider to disconnect:', labels);
    const selectedIndex = selected ? labels.indexOf(selected) : -1;
    return selectedIndex >= 0 ? storedProviders[selectedIndex] : undefined;
}

async function handleProviderDisconnect(
    args: string,
    pi: ExtensionAPI,
    ctx: ExtensionCommandContext,
    dependencies: BkperAuthCommandDependencies
): Promise<void> {
    if (isBkperProviderReference(args)) {
        ctx.ui.notify('Use /logout for Bkper.', 'warning');
        return;
    }

    const provider = await resolveProviderToDisconnect(args, ctx);
    if (!provider) {
        const message = args.trim()
            ? `No credentials saved by /connect for "${args.trim()}".`
            : 'No model provider credentials saved by /connect.';
        ctx.ui.notify(message, 'info');
        return;
    }

    const displayName = ctx.modelRegistry.getProviderDisplayName(provider);
    ctx.modelRegistry.authStorage.logout(provider);
    ctx.modelRegistry.refresh();

    const remainingKey = await ctx.modelRegistry.getApiKeyForProvider(provider);
    if (remainingKey) {
        ctx.ui.notify(
            `Removed stored credentials for ${displayName}. Environment or model configuration remains active.`,
            'info'
        );
        return;
    }

    const switched =
        ctx.model?.provider === provider
            ? await switchToAuthFallback(pi, ctx, dependencies, provider)
            : true;
    const guidance = switched ? '' : ' Use /login or /connect to continue.';
    ctx.ui.notify(`Disconnected ${displayName}.${guidance}`, 'info');
}

function isInternalAuthCommand(item: AutocompleteItem): boolean {
    return [
        BKPER_AGENT_LOGIN_COMMAND,
        BKPER_AGENT_LOGOUT_COMMAND,
        BKPER_AGENT_DISCONNECT_COMMAND,
    ].includes(item.value);
}

function matchesCommandPrefix(command: string, prefix: string): boolean {
    return command.toLowerCase().includes(prefix.toLowerCase());
}

function createAuthAutocompleteProvider(
    current: AutocompleteProvider,
    ctx: Pick<ExtensionCommandContext, 'modelRegistry'>
): AutocompleteProvider {
    const getSuggestions = async (
        lines: string[],
        cursorLine: number,
        cursorCol: number,
        options: {signal: AbortSignal; force?: boolean}
    ): Promise<AutocompleteSuggestions | null> => {
        const line = lines[cursorLine] ?? '';
        const beforeCursor = line.slice(0, cursorCol);

        if (/^\/login\s/.test(beforeCursor) || /^\/logout\s/.test(beforeCursor)) {
            return null;
        }

        const connectMatch = /^\/connect\s(.*)$/.exec(beforeCursor);
        if (connectMatch) {
            const argument = connectMatch[1] ?? '';
            const syntheticLines = [...lines];
            syntheticLines[cursorLine] = `/login ${argument}${line.slice(cursorCol)}`;
            const suggestions = await current.getSuggestions(
                syntheticLines,
                cursorLine,
                `/login ${argument}`.length,
                options
            );
            if (!suggestions) {
                return null;
            }
            return {
                ...suggestions,
                items: suggestions.items.filter(
                    item =>
                        !isBkperProviderReference(item.value) &&
                        !isBkperProviderReference(item.label)
                ),
            };
        }

        const disconnectMatch = /^\/disconnect\s(.*)$/.exec(beforeCursor);
        if (disconnectMatch) {
            const argument = (disconnectMatch[1] ?? '').toLowerCase();
            const items = ctx.modelRegistry.authStorage
                .list()
                .filter(provider => provider !== BKPER_AI_PROVIDER_ID)
                .map(provider => ({
                    value: provider,
                    label: provider,
                    description: ctx.modelRegistry.getProviderDisplayName(provider),
                }))
                .filter(item =>
                    `${item.value} ${item.description}`.toLowerCase().includes(argument)
                );
            return items.length > 0 ? {items, prefix: disconnectMatch[1] ?? ''} : null;
        }

        if (/^\/[^\s]*$/.test(beforeCursor)) {
            const prefix = beforeCursor.slice(1);
            const base = await current.getSuggestions(lines, cursorLine, cursorCol, options);
            const items = (base?.items ?? [])
                .filter(item => !isInternalAuthCommand(item))
                .map(item => {
                    if (item.value === 'login') {
                        return {...item, description: 'Log in to Bkper'};
                    }
                    if (item.value === 'logout') {
                        return {...item, description: 'Log out of Bkper'};
                    }
                    return item;
                });
            const additional = [
                {value: 'connect', label: 'connect', description: 'Connect an AI model provider'},
                {
                    value: 'disconnect',
                    label: 'disconnect',
                    description: 'Disconnect an AI model provider',
                },
            ].filter(item => matchesCommandPrefix(item.value, prefix));
            for (const item of additional) {
                if (!items.some(existing => existing.value === item.value)) {
                    items.push(item);
                }
            }
            return items.length > 0
                ? {items, prefix: base?.prefix ?? beforeCursor}
                : null;
        }

        return current.getSuggestions(lines, cursorLine, cursorCol, options);
    };

    return {
        triggerCharacters: current.triggerCharacters,
        getSuggestions,
        applyCompletion: (lines, cursorLine, cursorCol, item, prefix) =>
            current.applyCompletion(lines, cursorLine, cursorCol, item, prefix),
        shouldTriggerFileCompletion: current.shouldTriggerFileCompletion
            ? (lines, cursorLine, cursorCol) =>
                  current.shouldTriggerFileCompletion?.(lines, cursorLine, cursorCol) ?? false
            : undefined,
    };
}

export function registerBkperAgentAuthExtension(
    pi: ExtensionAPI,
    dependencies: BkperAuthCommandDependencies = defaultAuthCommandDependencies
): void {
    pi.registerCommand(BKPER_AGENT_LOGIN_COMMAND, {
        handler: (args, ctx) => handleBkperLogin(args, pi, ctx, dependencies),
    });
    pi.registerCommand(BKPER_AGENT_LOGOUT_COMMAND, {
        handler: (args, ctx) => handleBkperLogout(args, pi, ctx, dependencies),
    });
    pi.registerCommand(BKPER_AGENT_DISCONNECT_COMMAND, {
        handler: (args, ctx) => handleProviderDisconnect(args, pi, ctx, dependencies),
    });
    pi.on('session_start', (_event, ctx) => {
        ctx.ui.addAutocompleteProvider(current =>
            createAuthAutocompleteProvider(current, ctx)
        );
    });
}
