import { expect } from '../../unit/helpers/test-setup.js';
import sinon from 'sinon';
import {
    formatItem,
    formatList,
    formatMatrix,
    renderItem,
    renderList,
    renderMatrix,
    renderNotice,
} from '../../../src/render/output.js';

describe('output', function () {
    let consoleLogStub: sinon.SinonStub;
    let consoleErrorStub: sinon.SinonStub;

    beforeEach(function () {
        consoleLogStub = sinon.stub(console, 'log');
        consoleErrorStub = sinon.stub(console, 'error');
    });

    afterEach(function () {
        consoleLogStub.restore();
        consoleErrorStub.restore();
    });

    describe('formatList', function () {
        it('should always wrap items in an items envelope', function () {
            const parsed = JSON.parse(formatList([{ id: 'tx-1' }]));
            expect(parsed).to.deep.equal({ items: [{ id: 'tx-1' }] });
        });

        it('should render an empty list as an empty items envelope', function () {
            expect(JSON.parse(formatList([]))).to.deep.equal({ items: [] });
        });

        it('should include cursor only when present', function () {
            const parsed = JSON.parse(formatList([{ id: 'file-1' }], 'next-page'));
            expect(parsed).to.deep.equal({ items: [{ id: 'file-1' }], cursor: 'next-page' });
        });

        it('should place each record on its own line', function () {
            const items = [
                { id: 'tx-1', creditAccount: { id: 'a1', name: 'Bank' } },
                { id: 'tx-2', creditAccount: { id: 'a2', name: 'Sales' } },
            ];

            const output = formatList(items, 'c1');
            const recordLines = output.split('\n').filter(line => line.includes('"id":"tx-'));

            expect(recordLines).to.have.length(2);
            expect(JSON.parse(recordLines[0].replace(/,$/, ''))).to.deep.equal(items[0]);
            expect(JSON.parse(recordLines[1].replace(/,$/, ''))).to.deep.equal(items[1]);
        });
    });

    describe('formatMatrix', function () {
        it('should place each row on its own line and remain valid JSON', function () {
            const matrix = [
                ['', '2024-01-31', '2024-02-29'],
                ['Assets', 100.5, 200],
                ['Liabilities', -100.5, -200],
            ];

            const output = formatMatrix(matrix);

            expect(JSON.parse(output)).to.deep.equal(matrix);
            const rowLines = output.split('\n').filter(line => line.trim().startsWith('['));
            expect(rowLines.filter(line => line !== '[')).to.have.length(3);
        });

        it('should render an empty matrix as an empty array', function () {
            expect(JSON.parse(formatMatrix([]))).to.deep.equal([]);
        });
    });

    describe('formatItem', function () {
        it('should pretty print when requested', function () {
            const output = formatItem({ name: 'Checking', type: 'ASSET' }, true);
            expect(output).to.contain('\n  "name": "Checking"');
            expect(JSON.parse(output)).to.deep.equal({ name: 'Checking', type: 'ASSET' });
        });

        it('should print compact single-line JSON otherwise', function () {
            const output = formatItem({ name: 'Checking', type: 'ASSET' }, false);
            expect(output).to.equal('{"name":"Checking","type":"ASSET"}');
        });
    });

    describe('renderList', function () {
        it('should write data to stdout and the hint to stderr', function () {
            renderList({ items: [{ id: 'f1' }], cursor: 'c1', hint: 'Next page: bkper file list' });

            expect(consoleLogStub.calledOnce).to.equal(true);
            expect(JSON.parse(consoleLogStub.firstCall.args[0])).to.deep.equal({
                items: [{ id: 'f1' }],
                cursor: 'c1',
            });
            expect(consoleErrorStub.calledOnceWithExactly('Next page: bkper file list')).to.equal(
                true
            );
        });

        it('should not write to stderr when there is no hint', function () {
            renderList({ items: [] });
            expect(consoleErrorStub.called).to.equal(false);
        });
    });

    describe('renderMatrix', function () {
        it('should write the matrix as JSON to stdout', function () {
            renderMatrix([['Cash', 10]]);
            expect(JSON.parse(consoleLogStub.firstCall.args[0])).to.deep.equal([['Cash', 10]]);
        });
    });

    describe('renderItem', function () {
        it('should write compact JSON when pretty is false', function () {
            renderItem({ id: 'acc-1' }, false);
            expect(consoleLogStub.firstCall.args[0]).to.equal('{"id":"acc-1"}');
        });

        it('should write pretty JSON when pretty is true', function () {
            renderItem({ id: 'acc-1' }, true);
            expect(consoleLogStub.firstCall.args[0]).to.equal('{\n  "id": "acc-1"\n}');
        });
    });

    describe('renderNotice', function () {
        it('should write notices to stderr, never stdout', function () {
            renderNotice('Collection col-1 deleted.');
            expect(consoleErrorStub.calledOnceWithExactly('Collection col-1 deleted.')).to.equal(
                true
            );
            expect(consoleLogStub.called).to.equal(false);
        });
    });
});
