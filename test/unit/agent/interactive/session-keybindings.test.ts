import sinon from 'sinon';
import {expect} from '../../helpers/test-setup.js';
import {
    applyBkperSessionKeybindings,
    installBkperSessionKeybindings,
} from '../../../../src/agent/interactive/session-keybindings.js';

describe('interactive session keybindings', function () {
    it('adds Bkper session keybindings without overwriting user bindings', function () {
        let userBindings: Record<string, string | string[] | undefined> = {
            'app.session.resume': 'ctrl+q',
            'app.session.tree': [],
        };
        const keybindings = {
            getUserBindings: () => userBindings,
            setUserBindings: (nextBindings: Record<string, string | string[] | undefined>) => {
                userBindings = nextBindings;
            },
        };

        applyBkperSessionKeybindings(keybindings);

        expect(userBindings).to.deep.equal({
            'app.session.resume': 'ctrl+q',
            'app.session.tree': [],
            'app.session.fork': 'ctrl+x',
        });
    });

    it('skips Bkper session shortcuts claimed by user bindings', function () {
        let userBindings: Record<string, string | string[] | undefined> = {
            'tui.editor.cursorRight': 'ctrl+x',
        };
        const keybindings = {
            getUserBindings: () => userBindings,
            setUserBindings: (nextBindings: Record<string, string | string[] | undefined>) => {
                userBindings = nextBindings;
            },
        };

        applyBkperSessionKeybindings(keybindings);

        expect(userBindings).to.deep.equal({
            'tui.editor.cursorRight': 'ctrl+x',
            'app.session.resume': 'ctrl+s',
            'app.session.tree': 'ctrl+r',
        });
    });

    it('reapplies Bkper session keybindings after keybindings reload', function () {
        let userBindings: Record<string, string | string[] | undefined> = {};
        const keybindings = {
            getUserBindings: () => userBindings,
            setUserBindings: (nextBindings: Record<string, string | string[] | undefined>) => {
                userBindings = nextBindings;
            },
            reload: sinon.stub().callsFake(() => {
                userBindings = {};
            }),
        };

        installBkperSessionKeybindings(keybindings);
        keybindings.reload();

        expect(userBindings).to.deep.equal({
            'app.session.resume': 'ctrl+s',
            'app.session.tree': 'ctrl+r',
            'app.session.fork': 'ctrl+x',
        });
    });
});
