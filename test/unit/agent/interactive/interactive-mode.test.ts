import {InteractiveMode} from '@earendil-works/pi-coding-agent';
import sinon from 'sinon';
import {expect} from '../../helpers/test-setup.js';
import {
    BkperInteractiveMode,
    suppressPiResumeHintOutput,
} from '../../../../src/agent/interactive/interactive-mode.js';
import {FilePromptHistory} from '../../../../src/agent/interactive/prompt-history-store.js';

describe('BkperInteractiveMode', function () {
    afterEach(function () {
        sinon.restore();
    });

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

    it('routes /connect through the session model runtime', async function () {
        const unregisterProvider = sinon.stub();
        const registerProvider = sinon.stub();
        const submitted: string[] = [];
        let editorText = '';
        const editor = {
            getText: () => editorText,
            setText: (text: string) => {
                editorText = text;
            },
            handleInput: sinon.stub(),
            onSubmit: async (text: string) => {
                submitted.push(text);
            },
        };
        const mode: Record<string, unknown> = {
            defaultEditor: editor,
            session: {
                modelRuntime: {
                    unregisterProvider,
                    registerProvider,
                },
            },
        };
        sinon.stub(InteractiveMode.prototype, 'init').resolves();
        sinon.stub(FilePromptHistory.prototype, 'record');

        await BkperInteractiveMode.prototype.init.call(mode);
        await editor.onSubmit('/connect');

        expect(submitted).to.deep.equal(['/login']);
        expect(unregisterProvider.calledOnceWithExactly('bkper')).to.equal(true);
        expect(registerProvider.called).to.equal(false);
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
