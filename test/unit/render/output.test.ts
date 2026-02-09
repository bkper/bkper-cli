import { expect } from '../../unit/helpers/test-setup.js';
import sinon from 'sinon';
import { renderTable, renderItem } from '../../../src/render/output.js';

describe('output', function () {
    let consoleLogStub: sinon.SinonStub;

    beforeEach(function () {
        consoleLogStub = sinon.stub(console, 'log');
    });

    afterEach(function () {
        consoleLogStub.restore();
    });

    describe('renderTable', function () {
        it('should output formatted table by default', function () {
            const matrix = [
                ['Name', 'Type'],
                ['Revenue', 'INCOMING'],
                ['Expenses', 'OUTGOING'],
            ];

            renderTable(matrix, false);

            const output = consoleLogStub.firstCall.args[0] as string;
            expect(output).to.contain('Name');
            expect(output).to.contain('Revenue');
            expect(output).to.contain('INCOMING');
            // Should have underscore divider
            expect(output).to.match(/_+/);
        });

        it('should output JSON when json flag is true', function () {
            const matrix = [
                ['Name', 'Type'],
                ['Revenue', 'INCOMING'],
            ];

            renderTable(matrix, true);

            const output = consoleLogStub.firstCall.args[0] as string;
            const parsed = JSON.parse(output);
            expect(parsed).to.be.an('array');
            expect(parsed).to.have.length(2);
            expect(parsed[0]).to.deep.equal(['Name', 'Type']);
        });

        it('should render a single-row headerless matrix as table', function () {
            const matrix = [['Total Equity', '-1753687.09']];

            renderTable(matrix, false);

            const output = consoleLogStub.firstCall.args[0] as string;
            expect(output).to.contain('Total Equity');
            expect(output).to.contain('-1753687.09');
        });

        it('should print "No results found." for empty matrix', function () {
            renderTable([], false);

            const output = consoleLogStub.firstCall.args[0] as string;
            expect(output).to.equal('No results found.');
        });

        it('should output empty JSON array when json flag is true and no data', function () {
            renderTable([], true);

            const output = consoleLogStub.firstCall.args[0] as string;
            const parsed = JSON.parse(output);
            expect(parsed).to.deep.equal([]);
        });
    });

    describe('renderItem', function () {
        it('should output key-value pairs by default', function () {
            const item = { name: 'Checking', type: 'ASSET' };

            renderItem(item, false);

            const output = consoleLogStub.firstCall.args[0] as string;
            expect(output).to.contain('name:');
            expect(output).to.contain('Checking');
            expect(output).to.contain('type:');
            expect(output).to.contain('ASSET');
        });

        it('should output JSON when json flag is true', function () {
            const item = { name: 'Checking', type: 'ASSET' };

            renderItem(item, true);

            const output = consoleLogStub.firstCall.args[0] as string;
            const parsed = JSON.parse(output);
            expect(parsed).to.deep.equal({ name: 'Checking', type: 'ASSET' });
        });

        it('should handle empty item in table mode', function () {
            renderItem({}, false);

            const output = consoleLogStub.firstCall.args[0] as string;
            expect(output).to.equal('No results found.');
        });
    });
});
