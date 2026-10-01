import {
    backgroundAnsi,
    foregroundAnsi,
    rgbColor,
    type Color,
    type TerminalColorMode,
} from '@earendil-works/pi-tui';

const RESET = '\x1b[0m';

/** Official logo colors; the four mark colors are the four Bkper account type colors. */
const BKPER_LOGO_COLORS: Record<string, Color> = {
    B: rgbColor(34, 133, 192), // #2285c0 Asset blue
    D: rgbColor(30, 119, 173), // #1e77ad stem shade under the bar
    R: rgbColor(209, 72, 54), // #d14836 Outgoing red
    Y: rgbColor(247, 179, 0), // #f7b300 Liability yellow
    G: rgbColor(58, 170, 87), // #3aaa57 Incoming green
    W: rgbColor(153, 153, 153), // #999999 arrow and wordmark gray
};

/**
 * The Bkper logo as square pixels, two pixel rows per terminal line. The mark is the official
 * icon geometry sampled at 2 pixels per logo unit; the wordmark sits on the mark's baseline.
 * '.' is transparent.
 */
const BKPER_LOGO_PIXELS = [
    '.......BB.............................................',
    '......BBBB............................................',
    '......BBBB............................................',
    '......BBBB............................................',
    '......BBBB............................................',
    '......BBBB............................................',
    '......BBBB............................................',
    '......BBBB............................................',
    '......BRRRRRRYYYY.....................................',
    '......RRRRRRYYYYYY....................................',
    '......RRRRRRYYYYYYY...................................',
    '......BRRRRRRYYYYYYY..................................',
    '......BBDD.....YYYYY..................................',
    '......BBDD......YYYY..W......W........................',
    '......BBBD......YYYY..W......W........................',
    'W.....BBBB.....YYYYY..W.WW...W..W..W.WW....WWW...W.WW.',
    'WW....BBBBGGGGGYYYYY..WW..W..W.W...WW..W..W...W..WW...',
    'WWW...BBBBGGGGGGYYY...W...W..WW....W...W..WWWWW..W....',
    'WW....BBBBGGGGGGYY....WW..W..W.W...WW..W..W......W....',
    'W......BBBGGGGGGY.....W.WW...W..W..W.WW....WWW...W....',
    '...................................W..................',
    '...................................W..................',
];

/** Width of the arrow and mark, without the wordmark. */
const BKPER_MARK_WIDTH = 20;

/**
 * Renders a pixel grid with half blocks: each terminal line shows two pixel rows, the upper one
 * as the foreground of '▀' and the lower one as its background.
 */
export function renderPixelArt(
    pixels: readonly string[],
    colors: Readonly<Record<string, Color>>,
    mode: TerminalColorMode
): string[] {
    const lines: string[] = [];
    for (let row = 0; row < pixels.length; row += 2) {
        const upper = pixels[row];
        const lower = pixels[row + 1] ?? '';
        const width = Math.max(upper.length, lower.length);
        let line = '';
        for (let column = 0; column < width; column++) {
            const top = colors[upper[column]];
            const bottom = colors[lower[column]];
            if (top && bottom && top === bottom) {
                line += `${foregroundAnsi(top, mode)}█${RESET}`;
            } else if (top && bottom) {
                line += `${foregroundAnsi(top, mode)}${backgroundAnsi(bottom, mode)}▀${RESET}`;
            } else if (top) {
                line += `${foregroundAnsi(top, mode)}▀${RESET}`;
            } else if (bottom) {
                line += `${foregroundAnsi(bottom, mode)}▄${RESET}`;
            } else {
                line += ' ';
            }
        }
        lines.push(line);
    }
    return lines;
}

function cropPixels(pixels: readonly string[], width: number): string[] {
    const cropped = pixels.map(row => row.slice(0, width));
    while (cropped.length > 0 && /^\.*$/.test(cropped[cropped.length - 1])) {
        cropped.pop();
    }
    return cropped;
}

/** The logo with wordmark when it fits, the mark alone when only that fits, otherwise nothing. */
export function getBkperLogoLines(maxWidth: number, mode: TerminalColorMode): string[] {
    const fullWidth = Math.max(...BKPER_LOGO_PIXELS.map(row => row.length));
    if (maxWidth >= fullWidth) {
        return renderPixelArt(cropPixels(BKPER_LOGO_PIXELS, fullWidth), BKPER_LOGO_COLORS, mode);
    }
    if (maxWidth >= BKPER_MARK_WIDTH) {
        return renderPixelArt(
            cropPixels(BKPER_LOGO_PIXELS, BKPER_MARK_WIDTH),
            BKPER_LOGO_COLORS,
            mode
        );
    }
    return [];
}
