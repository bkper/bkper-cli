import {
    getPowerShellConfig,
    getShellConfig,
    type AgentSessionRuntimeDiagnostic,
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

export function resolveBkperAgentTools(
    configuredTools: string[] | undefined,
    platform: NodeJS.Platform,
    availability: ShellAvailability
): ResolvedBkperAgentTools {
    if (configuredTools) {
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

    if (platform === 'win32' && availability.powershell) {
        return {tools: ['read', 'powershell', 'edit', 'write']};
    }

    if (availability.bash) {
        return platform === 'win32'
            ? {
                  tools: ['read', 'bash', 'edit', 'write'],
                  warning: 'PowerShell is unavailable; using Bash instead.',
              }
            : {tools: ['read', 'bash', 'edit', 'write']};
    }

    return {
        tools: ['read', 'edit', 'write'],
        warning: 'No supported shell is available; command execution is disabled.',
    };
}

type BkperAgentToolSettingsManager = {
    getDefaultTools(): string[] | undefined;
    getShellPath(): string | undefined;
    applyOverrides(overrides: {defaultTools: string[]}): void;
};

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
    const resolved = resolveBkperAgentTools(
        settingsManager.getDefaultTools(),
        effectivePlatform,
        availability
    );

    settingsManager.applyOverrides({defaultTools: resolved.tools});

    return resolved.warning ? [{type: 'warning', message: resolved.warning}] : [];
}

type BkperAgentSettingsDefaultsManager = {
    getGlobalSettings(): {
        showCacheMissNotices?: boolean;
        tuiMode?: TuiMode;
    };
    getProjectSettings(): {
        showCacheMissNotices?: boolean;
        tuiMode?: TuiMode;
    };
    setShowCacheMissNotices(show: boolean): void;
    setTuiMode(mode: TuiMode): void;
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
