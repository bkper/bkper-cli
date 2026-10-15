/**
 * Runtime access to the Pi packages that Pi itself uses.
 *
 * The agent bundle inlines pi-tui and pi-ai once, and Pi's code and ours must share that single copy:
 * a second instance breaks `instanceof` checks and hides module state such as the user's keybindings.
 * Routing every runtime value from pi-tui or pi-ai through this file keeps it that way.
 * Type-only imports are fine anywhere.
 */

export {
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
} from '@earendil-works/pi-tui';

export {typesafeSystemOneApi} from '@earendil-works/pi-ai/api/typesafe-system-one.lazy';
