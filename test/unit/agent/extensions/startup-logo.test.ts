import {rgbColor, stripTerminalSequences, visibleWidth} from '@earendil-works/pi-tui';
import {expect} from '../../helpers/test-setup.js';
import {
    getBkperLogoLines,
    isOverBkperMark,
    renderPixelArt,
} from '../../../../src/agent/extensions/startup-logo.js';

const RED = rgbColor(255, 0, 0);
const BLUE = rgbColor(0, 0, 255);

describe('Bkper startup logo', function () {
    it('packs two pixel rows into each terminal line with half blocks', function () {
        const lines = renderPixelArt(['RR.', 'RB.', '.B.'], {R: RED, B: BLUE}, 'truecolor');

        expect(lines).to.have.length(2);
        expect(lines.map(stripTerminalSequences)).to.deep.equal(['█▀ ', ' ▀ ']);
        expect(lines[0]).to.include('\x1b[38;2;255;0;0m'); // red over red, red over blue
        expect(lines[0]).to.include('\x1b[48;2;0;0;255m');
        expect(lines[1]).to.include('\x1b[38;2;0;0;255m'); // blue over the transparent padding row
    });

    it('fits the logo to the available width', function () {
        const full = getBkperLogoLines(80, 'truecolor');
        const markOnly = getBkperLogoLines(30, 'truecolor');

        expect(full.length).to.be.greaterThan(0);
        expect(Math.max(...full.map(visibleWidth))).to.be.at.most(80);
        expect(markOnly.length).to.be.greaterThan(0);
        expect(Math.max(...markOnly.map(visibleWidth))).to.be.at.most(30);
        expect(Math.max(...markOnly.map(visibleWidth))).to.be.lessThan(
            Math.max(...full.map(visibleWidth))
        );
        expect(getBkperLogoLines(10, 'truecolor')).to.deep.equal([]);
    });

    it('finds the mark in the rendered logo, apart from the wordmark', function () {
        const markLines = getBkperLogoLines(30, 'truecolor');
        const lastMarkRow = markLines.length - 1;
        const markWidth = Math.max(...markLines.map(visibleWidth));

        expect(isOverBkperMark(0, 0, 80)).to.be.true;
        expect(isOverBkperMark(markWidth - 1, lastMarkRow, 80)).to.be.true;
        expect(isOverBkperMark(markWidth, 0, 80)).to.be.false; // the wordmark
        expect(isOverBkperMark(0, lastMarkRow + 1, 80)).to.be.false;
        expect(isOverBkperMark(-1, 0, 80)).to.be.false;
        expect(isOverBkperMark(0, 0, 10)).to.be.false; // no logo is rendered that narrow
    });
});
