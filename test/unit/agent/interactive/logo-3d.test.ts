import {rgbColor, stripTerminalSequences, visibleWidth} from '@earendil-works/pi-tui';
import sinon from 'sinon';
import {expect} from '../../helpers/test-setup.js';
import {
    createLogoModel,
    Logo3dAnimation,
    type Logo3dPalette,
} from '../../../../src/agent/interactive/logo-3d.js';

const LOGO = {
    pixels: ['BB..', 'BBRR', '..RR', 'RR..'],
    colors: {B: rgbColor(34, 133, 192), R: rgbColor(209, 72, 54)},
};

const PALETTE: Logo3dPalette = {
    foreground: [220, 220, 220],
    background: [30, 30, 30],
    hintKey: [150, 150, 150],
    hintText: [100, 100, 100],
    colorMode: 'truecolor',
};

const WIDTH = 60;
const ROWS = 20;
const SCREEN_TEXT = 'Reconciled balances for the period';

describe('3D logo animation', function () {
    let clock: sinon.SinonFakeTimers;

    beforeEach(function () {
        clock = sinon.useFakeTimers({toFake: ['performance', 'setInterval', 'clearInterval']});
    });

    afterEach(function () {
        clock.restore();
    });

    function createAnimation(onDone: () => void = () => {}): Logo3dAnimation {
        const screen = Array.from({length: ROWS}, (_, row) =>
            row === 15 ? `   \x1b[32m${SCREEN_TEXT}\x1b[0m` : ''
        );
        const host = {terminal: {rows: ROWS}, requestRender: () => {}};
        const model = createLogoModel(LOGO, {column: 1, row: 1});
        return new Logo3dAnimation(host, screen, model, PALETTE, onDone);
    }

    function renderText(animation: Logo3dAnimation): string {
        return animation.render(WIDTH).map(stripTerminalSequences).join('\n');
    }

    it('keeps every frame within the terminal, from lift-off through the exit', function () {
        const animation = createAnimation();
        const checkFrame = () => {
            const lines = animation.render(WIDTH);
            expect(lines).to.have.length(ROWS);
            for (const line of lines) expect(visibleWidth(line)).to.be.at.most(WIDTH);
        };

        for (let frame = 0; frame < 12; frame++) {
            checkFrame();
            clock.tick(700); // through the flight, the spin, and a puzzle cycle
        }
        animation.close();
        for (let frame = 0; frame < 5; frame++) {
            checkFrame();
            clock.tick(200);
        }
    });

    it('dissolves the screen into the spinning logo and reassembles it on close', function () {
        const onDone = sinon.spy();
        const animation = createAnimation(onDone);

        expect(renderText(animation)).to.include(SCREEN_TEXT);

        clock.tick(5000);
        const dissolved = renderText(animation);
        expect(dissolved).to.not.include(SCREEN_TEXT);
        expect(dissolved).to.match(/[\u2801-\u28ff]/); // the logo is drawn with braille dots

        animation.close();
        clock.tick(1050);
        expect(renderText(animation)).to.include(SCREEN_TEXT);

        clock.tick(200);
        expect(onDone.calledOnce).to.be.true;
    });
});
