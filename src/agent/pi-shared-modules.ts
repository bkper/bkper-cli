import {existsSync} from 'node:fs';
import {createRequire} from 'node:module';
import path from 'node:path';
import type * as PiAiTypesafeSystemOne from '@earendil-works/pi-ai/api/typesafe-system-one.lazy';
import type * as PiTui from '@earendil-works/pi-tui';

/**
 * Runtime access to the Pi packages that Pi itself uses.
 *
 * pi-coding-agent publishes an npm-shrinkwrap.json, so npm installs its own copies of pi-tui and pi-ai nested
 * under it instead of sharing ours. Importing those packages directly would load a second, separate instance:
 * `instanceof` checks against Pi's objects fail and module state such as the user's keybindings is not seen.
 * Bun ignores the shrinkwrap and installs a single copy, so the problem never shows up in local development.
 *
 * Every runtime value from pi-tui or pi-ai must come from here. Type-only imports are fine anywhere.
 */

export interface PiSharedModulePaths {
    tui: string;
    aiTypesafeSystemOne: string;
}

/** The files pi-coding-agent, at `codingAgentEntry`, loads for the modules bkper shares with it. */
export function resolvePiSharedModulePaths(codingAgentEntry: string): PiSharedModulePaths {
    const requireFromCodingAgent = createRequire(codingAgentEntry);
    return {
        tui: requireFromCodingAgent.resolve('@earendil-works/pi-tui'),
        // pi-ai exports its entry points for `import` only, which require() cannot resolve, so locate the package
        // and take the file behind its `./api/typesafe-system-one.lazy` export. Pi is pinned to an exact version
        // and a unit test loads this file, so a layout change surfaces on the next Pi update.
        aiTypesafeSystemOne: path.join(
            resolvePackageDir(requireFromCodingAgent, '@earendil-works/pi-ai'),
            'dist',
            'api',
            'typesafe-system-one.lazy.js'
        ),
    };
}

function resolvePackageDir(require: NodeJS.Require, packageName: string): string {
    for (const nodeModulesDir of require.resolve.paths(packageName) ?? []) {
        const packageDir = path.join(nodeModulesDir, packageName);
        if (existsSync(path.join(packageDir, 'package.json'))) return packageDir;
    }
    throw new Error(`Cannot find ${packageName} from @earendil-works/pi-coding-agent`);
}

const codingAgentEntry = import.meta.resolve('@earendil-works/pi-coding-agent');
const paths = resolvePiSharedModulePaths(codingAgentEntry);
// Node returns the same module instance for require() and import of an ES module file.
const requireModule = createRequire(codingAgentEntry);
const piTui: typeof PiTui = requireModule(paths.tui);
const piAiTypesafeSystemOne: typeof PiAiTypesafeSystemOne = requireModule(paths.aiTypesafeSystemOne);

export const {
    backgroundAnsi,
    Box,
    colorToRgb,
    CombinedAutocompleteProvider,
    Editor,
    foregroundAnsi,
    getKeybindings,
    indexedColor,
    matchesKey,
    rgbColor,
    truncateToWidth,
    TuiAltScreen,
    visibleWidth,
} = piTui;
export type Box = PiTui.Box;
export type Editor = PiTui.Editor;

export const {typesafeSystemOneApi} = piAiTypesafeSystemOne;
