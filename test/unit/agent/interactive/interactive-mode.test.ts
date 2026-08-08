import {expect} from '../../helpers/test-setup.js';
import {
    BkperInteractiveMode,
    suppressPiResumeHintOutput,
} from '../../../../src/agent/interactive/interactive-mode.js';

describe('BkperInteractiveMode', function () {
    it('suppresses the Pi changelog banner', async function () {
        const mode: Record<string, unknown> = {};

        try {
            await BkperInteractiveMode.prototype.init.call(mode);
        } catch {
            // expected — mode lacks InteractiveMode internals
        }

        expect(typeof mode.getChangelogForDisplay).to.equal('function');
        expect((mode.getChangelogForDisplay as () => unknown)()).to.equal(undefined);
    });

    it('suppresses the Pi exit resume hint', function () {
        const originalWrite = process.stdout.write;
        const writes: string[] = [];
        const fakeWrite = ((chunk: string | Uint8Array) => {
            writes.push(String(chunk));
            return true;
        }) as typeof process.stdout.write;

        process.stdout.write = fakeWrite;
        const restore = suppressPiResumeHintOutput();

        try {
            process.stdout.write('\x1B[2mTo resume this session:\x1B[22m pi --session abc123\n');
            process.stdout.write('rendered chat mentions To resume this session: as text\n');
            process.stdout.write('other output\n');
        } finally {
            restore();
            process.stdout.write = originalWrite;
        }

        expect(writes).to.deep.equal([
            'rendered chat mentions To resume this session: as text\n',
            'other output\n',
        ]);
    });
});
