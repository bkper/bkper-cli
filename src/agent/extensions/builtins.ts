import {
    getAgentDir,
    type Extension,
    type ExtensionAPI,
    type LoadExtensionsResult,
} from '@earendil-works/pi-coding-agent';
import {runStartupMaintenance} from '../startup-maintenance.js';
import {
    registerBkperAgentAuthExtension,
    type ProviderCredentialManager,
} from './auth-commands.js';
import {
    getBkperAiBaseUrlOverride,
    registerBkperAiProvider,
} from './bkper-ai-provider.js';
import {registerBkperCoreConceptsPreloadExtension} from './core-concepts-preload.js';
import {
    FileAutoHandoffSettings,
    getAutoHandoffSettingsPath,
    getBkperHandoffShortcutFromFile,
    registerBkperHandoffExtension,
    type HandoffCommandDispatcher,
} from './handoff.js';
import {registerBkperImageFallbackExtension} from './image-fallback.js';
import {registerBkperAgentStartupExtension} from './startup.js';

type ExtensionLoadError = {
    path: string;
    error: string;
};

type BuiltinsSettings = {
    getQuietStartup(): boolean;
    getCompactionReserveTokens(): number;
    getShellPath(): string | undefined;
};

// Pi currently labels inline extension factories as <inline:N>.
// Keep Bkper's label synthetic too: Pi resolves plain extension paths as files.
const INLINE_EXTENSION_PATH_PATTERN = /^<inline:\d+>$/;
export const BKPER_AGENT_BUILTINS_EXTENSION_NAME = 'Bkper Agent built-ins';
export const BKPER_AGENT_BUILTINS_EXTENSION_PATH = '<inline:bkper-agent-builtins>';
const BUILT_IN_BKPER_AGENT_FEATURE_ERROR = `${BKPER_AGENT_BUILTINS_EXTENSION_NAME} failed to start.`;

export function isBkperAgentVerboseDiagnosticsEnabled(
    env: Record<string, string | undefined> = process.env
): boolean {
    return env.BKPER_AGENT_DEBUG === '1' || env.PI_VERBOSE === '1';
}

function isBkperAgentInlineExtensionPath(path: string): boolean {
    return INLINE_EXTENSION_PATH_PATTERN.test(path);
}

function normalizeBkperAgentExtension(extension: Extension): Extension {
    if (!isBkperAgentInlineExtensionPath(extension.path)) {
        return extension;
    }

    return {
        ...extension,
        path: BKPER_AGENT_BUILTINS_EXTENSION_PATH,
        resolvedPath: BKPER_AGENT_BUILTINS_EXTENSION_PATH,
        sourceInfo: {
            ...extension.sourceInfo,
            path: BKPER_AGENT_BUILTINS_EXTENSION_PATH,
            source: 'inline',
        },
    };
}

export function normalizeBkperAgentExtensionErrors(
    errors: ExtensionLoadError[],
    options: {verbose: boolean}
): ExtensionLoadError[] {
    return errors.map(error => {
        if (!isBkperAgentInlineExtensionPath(error.path)) {
            return error;
        }

        return {
            path: BKPER_AGENT_BUILTINS_EXTENSION_PATH,
            error: options.verbose
                ? `${BUILT_IN_BKPER_AGENT_FEATURE_ERROR}\nDetails: ${error.path} ${error.error}`
                : BUILT_IN_BKPER_AGENT_FEATURE_ERROR,
        };
    });
}

export function normalizeBkperAgentExtensions(
    base: LoadExtensionsResult,
    options: {verbose: boolean}
): LoadExtensionsResult {
    return {
        ...base,
        extensions: base.extensions.map(normalizeBkperAgentExtension),
        errors: normalizeBkperAgentExtensionErrors(base.errors, options),
    };
}

export function registerBkperAgentBuiltins(
    pi: ExtensionAPI,
    startupMaintenance: typeof runStartupMaintenance = runStartupMaintenance,
    settingsManager?: BuiltinsSettings,
    env: Record<string, string | undefined> = process.env,
    credentialManager?: ProviderCredentialManager,
    dispatchHandoffCommand?: HandoffCommandDispatcher
): void {
    const bkperAiBaseUrlOverride = getBkperAiBaseUrlOverride(env);

    registerBkperCoreConceptsPreloadExtension(pi);
    registerBkperAgentStartupExtension(
        pi,
        startupMaintenance,
        settingsManager,
        bkperAiBaseUrlOverride
    );
    registerBkperAgentAuthExtension(pi, undefined, credentialManager);
    registerBkperAiProvider(pi, env);
    registerBkperImageFallbackExtension(pi);
    registerBkperHandoffExtension(
        pi,
        new FileAutoHandoffSettings(getAutoHandoffSettingsPath(getAgentDir())),
        () => settingsManager?.getCompactionReserveTokens() ?? 16384,
        undefined,
        env,
        dispatchHandoffCommand,
        getBkperHandoffShortcutFromFile(getAgentDir())
    );
}
