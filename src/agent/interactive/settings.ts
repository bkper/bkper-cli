import {
    getPowerShellConfig,
    getShellConfig,
    type AgentSessionRuntimeDiagnostic,
    type CacheWarmingMode,
    type TuiMode,
} from '@earendil-works/pi-coding-agent';

type SettingsError = {
    scope: 'global' | 'project';
    error: Error;
};

export interface ShellAvailability {
    bash: boolean;
    powershell: boolean;
}

export interface ResolvedBkperAgentTools {
    tools: string[];
    warning?: string;
}

// Always selected so the tool set, and with it the prompt cache, stays stable across turns.
const CODEMODE_TOOL = 'codemode';

function isToolModifier(entry: unknown): boolean {
    return typeof entry === 'string' && (entry.startsWith('+') || entry.startsWith('-'));
}

/** Applies `+name`/`-name` entries in order, as Pi does for `defaultTools`. */
function applyToolModifiers(tools: string[], modifiers: string[]): string[] {
    const result = [...tools];
    for (const modifier of modifiers) {
        const name = modifier.slice(1);
        const index = result.indexOf(name);
        if (modifier.startsWith('+') && index === -1 && name) {
            result.push(name);
        } else if (modifier.startsWith('-') && index !== -1) {
            result.splice(index, 1);
        }
    }
    return result;
}

/**
 * Pi resolves a `defaultTools` selection without plain tool names in any settings layer against
 * its own defaults, which lack codemode and PowerShell. Returns those modifiers, global layer
 * first, so they can be applied to the Bkper defaults instead.
 */
function getModifierOnlyToolSelection(layers: unknown[]): string[] | undefined {
    const modifiers: string[] = [];
    for (const layer of layers) {
        if (layer === undefined) {
            continue;
        }
        if (!isModifierList(layer)) {
            return undefined;
        }
        modifiers.push(...layer);
    }
    return modifiers.length > 0 ? modifiers : undefined;
}

function isModifierList(layer: unknown): layer is string[] {
    return Array.isArray(layer) && layer.every(isToolModifier);
}

function disableUnavailableShells(
    configuredTools: string[],
    availability: ShellAvailability
): ResolvedBkperAgentTools {
    const unavailableShells = configuredTools.filter(
        tool =>
            (tool === 'bash' && !availability.bash) ||
            (tool === 'powershell' && !availability.powershell)
    );
    const tools = configuredTools.filter(tool => !unavailableShells.includes(tool));
    return unavailableShells.length > 0
        ? {
              tools,
              warning: `Unavailable configured shell tools were disabled: ${unavailableShells.join(
                  ', '
              )}.`,
          }
        : {tools};
}

export function resolveBkperAgentTools(
    configuredTools: string[] | undefined,
    platform: NodeJS.Platform,
    availability: ShellAvailability,
    toolModifiers: string[] = []
): ResolvedBkperAgentTools {
    if (configuredTools) {
        return disableUnavailableShells(configuredTools, availability);
    }

    const defaults = selectDefaultBkperAgentTools(platform, availability);
    if (toolModifiers.length === 0) {
        return defaults;
    }
    const modified = disableUnavailableShells(
        applyToolModifiers(defaults.tools, toolModifiers),
        availability
    );
    const warnings = [defaults.warning, modified.warning].filter(
        (warning): warning is string => warning !== undefined
    );
    return warnings.length > 0
        ? {tools: modified.tools, warning: warnings.join(' ')}
        : {tools: modified.tools};
}

function selectDefaultBkperAgentTools(
    platform: NodeJS.Platform,
    availability: ShellAvailability
): ResolvedBkperAgentTools {
    if (platform === 'win32' && availability.powershell) {
        return {tools: ['read', 'powershell', 'edit', 'write', CODEMODE_TOOL]};
    }

    if (availability.bash) {
        return platform === 'win32'
            ? {
                  tools: ['read', 'bash', 'edit', 'write', CODEMODE_TOOL],
                  warning: 'PowerShell is unavailable; using Bash instead.',
              }
            : {tools: ['read', 'bash', 'edit', 'write', CODEMODE_TOOL]};
    }

    return {
        tools: ['read', 'edit', 'write', CODEMODE_TOOL],
        warning: 'No supported shell is available; command execution is disabled.',
    };
}

type DefaultToolsSettingsManager = {
    getDefaultTools(): string[] | undefined;
    applyOverrides(overrides: {defaultTools: string[]}): void;
};

type BkperAgentToolSettingsManager = DefaultToolsSettingsManager & {
    getGlobalSettings(): {defaultTools?: string[]};
    getProjectSettings(): {defaultTools?: string[]};
    getShellPath(): string | undefined;
};

/**
 * Replaces the effective `defaultTools` selection. Pi appends an override without plain tool
 * names, including an empty list, to the inherited selection, so an empty selection is
 * expressed as removal of every currently selected tool.
 */
export function overrideDefaultTools(
    settingsManager: DefaultToolsSettingsManager,
    tools: string[]
): void {
    settingsManager.applyOverrides({
        defaultTools:
            tools.length > 0
                ? tools
                : (settingsManager.getDefaultTools() ?? []).map(tool => `-${tool}`),
    });
}

function canResolveShell(resolve: () => unknown): boolean {
    try {
        resolve();
        return true;
    } catch {
        return false;
    }
}

export function applyBkperAgentToolSelection(
    settingsManager: BkperAgentToolSettingsManager,
    platform: NodeJS.Platform = process.platform
): AgentSessionRuntimeDiagnostic[] {
    const forceWindows = process.env.BKPER_AGENT_FORCE_PLATFORM === 'win32';
    const effectivePlatform = forceWindows ? 'win32' : platform;
    const availability = {
        bash: canResolveShell(() => getShellConfig(settingsManager.getShellPath())),
        powershell:
            effectivePlatform === 'win32' &&
            (forceWindows || canResolveShell(() => getPowerShellConfig())),
    };
    const toolModifiers = getModifierOnlyToolSelection([
        settingsManager.getGlobalSettings().defaultTools,
        settingsManager.getProjectSettings().defaultTools,
    ]);
    const resolved = toolModifiers
        ? resolveBkperAgentTools(undefined, effectivePlatform, availability, toolModifiers)
        : resolveBkperAgentTools(
              settingsManager.getDefaultTools(),
              effectivePlatform,
              availability
          );

    overrideDefaultTools(settingsManager, resolved.tools);

    return resolved.warning ? [{type: 'warning', message: resolved.warning}] : [];
}

type BkperAgentSettingsDefaultsManager = {
    getGlobalSettings(): {
        showCacheMissNotices?: boolean;
        tuiMode?: TuiMode;
        cacheWarming?: CacheWarmingMode;
    };
    getProjectSettings(): {
        showCacheMissNotices?: boolean;
        tuiMode?: TuiMode;
    };
    setShowCacheMissNotices(show: boolean): void;
    setTuiMode(mode: TuiMode): void;
    setCacheWarmingMode(mode: CacheWarmingMode): void;
};

export function applyBkperAgentSettingsDefaults(
    settingsManager: BkperAgentSettingsDefaultsManager
): void {
    const globalSettings = settingsManager.getGlobalSettings();
    const projectSettings = settingsManager.getProjectSettings();
    const hasExplicitCacheMissNotices = [
        globalSettings.showCacheMissNotices,
        projectSettings.showCacheMissNotices,
    ].some(value => value !== undefined);
    const hasExplicitTuiMode = [globalSettings.tuiMode, projectSettings.tuiMode].some(
        value => value !== undefined
    );

    if (!hasExplicitCacheMissNotices) {
        settingsManager.setShowCacheMissNotices(true);
    }

    if (!hasExplicitTuiMode) {
        settingsManager.setTuiMode('fullscreen');
    }

    // Pi reads cacheWarming from global settings only. Idle warming bridges the pauses
    // between prompts; Pi warms only models with a known cache lifetime and only when
    // the expected savings outweigh the refresh cost.
    if (globalSettings.cacheWarming === undefined) {
        settingsManager.setCacheWarmingMode('idle');
    }
}

export function collectSettingsDiagnostics(
    settingsManager: {drainErrors(): SettingsError[]},
    context: string
): AgentSessionRuntimeDiagnostic[] {
    return settingsManager.drainErrors().map(({scope, error}) => ({
        type: 'warning',
        message: `(${context}, ${scope} settings) ${error.message}`,
    }));
}

export function createStartupSessionManager<TSessionManager>(
    cwd: string,
    settingsManager: {getSessionDir(): string | undefined},
    createSessionManager: (cwd: string, sessionDir?: string) => TSessionManager
): TSessionManager {
    return createSessionManager(cwd, settingsManager.getSessionDir());
}
