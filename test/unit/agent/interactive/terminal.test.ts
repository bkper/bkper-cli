import {ProcessTerminal, type ProgramStatus} from '@earendil-works/pi-tui';
import sinon from 'sinon';
import {expect} from '../../helpers/test-setup.js';
import {BkperTerminal} from '../../../../src/agent/interactive/terminal.js';

describe('BkperTerminal', function () {
    afterEach(function () {
        sinon.restore();
    });

    it('brands default and named-session titles on every update', function () {
        const setTitle = sinon.stub(ProcessTerminal.prototype, 'setTitle');
        const terminal = new BkperTerminal();

        terminal.setTitle('π - bkper-cli');
        terminal.setTitle('π - Review changes - bkper-cli');
        terminal.setTitle('π - bkper-apps');

        expect(setTitle.args).to.deep.equal([
            ['bkper - bkper-cli'],
            ['bkper - Review changes - bkper-cli'],
            ['bkper - bkper-apps'],
        ]);
        expect(setTitle.alwaysCalledOn(terminal)).to.equal(true);
    });

    it('preserves custom extension titles', function () {
        const setTitle = sinon.stub(ProcessTerminal.prototype, 'setTitle');
        const terminal = new BkperTerminal();

        terminal.setTitle('Review π calculations');
        terminal.setTitle('Custom dashboard');

        expect(setTitle.args).to.deep.equal([
            ['Review π calculations'],
            ['Custom dashboard'],
        ]);
    });

    it('brands Pi status reports without changing activity or mutating the reports', function () {
        const setProgramStatus = sinon.stub(ProcessTerminal.prototype, 'setProgramStatus');
        const terminal = new BkperTerminal();
        const reports: ProgramStatus[] = [
            {state: 'idle', app: 'pi'},
            {state: 'working', app: 'pi', message: 'Review changes'},
            {state: 'blocked', app: 'pi', kind: 'permission', message: 'Approve?'},
            {state: 'blocked', app: 'pi', kind: 'question', message: 'Which file?'},
            {state: 'blocked', app: 'pi', kind: 'auth', message: 'Log in'},
            {state: 'done', app: 'pi', message: 'Review changes'},
            {state: 'error', app: 'pi', message: 'Connection failed'},
        ];

        for (const report of reports) {
            terminal.setProgramStatus(report);
        }

        expect(setProgramStatus.args).to.deep.equal(
            reports.map(report => [{...report, app: 'bkper'}])
        );
        expect(reports.every(report => report.app === 'pi')).to.equal(true);
        expect(setProgramStatus.alwaysCalledOn(terminal)).to.equal(true);
    });

    it('preserves status clearing and reports from other programs', function () {
        const setProgramStatus = sinon.stub(ProcessTerminal.prototype, 'setProgramStatus');
        const terminal = new BkperTerminal();
        const reports: ProgramStatus[] = [
            {state: 'clear'},
            {state: 'working', app: 'cargo', message: 'Building'},
        ];

        for (const report of reports) {
            terminal.setProgramStatus(report);
        }

        expect(setProgramStatus.args).to.deep.equal(reports.map(report => [report]));
    });
});
