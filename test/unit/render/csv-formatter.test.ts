import { expect } from '../../unit/helpers/test-setup.js';
import { formatCsv } from '../../../src/render/csv-formatter.js';

describe('csv-formatter', function () {
    describe('formatCsv', function () {
        it('should format a simple matrix with headers and data', function () {
            const matrix = [
                ['Name', 'Type', 'Balance'],
                ['Checking', 'ASSET', '1000.00'],
                ['Revenue', 'INCOMING', '5000.00'],
            ];

            const result = formatCsv(matrix);

            expect(result).to.equal(
                'Name,Type,Balance\r\nChecking,ASSET,1000.00\r\nRevenue,INCOMING,5000.00'
            );
        });

        it('should return empty string for empty matrix', function () {
            expect(formatCsv([])).to.equal('');
        });

        it('should return empty string for null/undefined input', function () {
            expect(formatCsv(null as unknown as unknown[][])).to.equal('');
            expect(formatCsv(undefined as unknown as unknown[][])).to.equal('');
        });

        it('should handle a single header row with no data', function () {
            const matrix = [['Name', 'Type']];
            const result = formatCsv(matrix);
            expect(result).to.equal('Name,Type');
        });

        it('should quote fields containing commas', function () {
            const matrix = [
                ['Name', 'Description'],
                ['Acme Corp', 'Sales, Marketing'],
            ];

            const result = formatCsv(matrix);
            const lines = result.split('\r\n');
            expect(lines[1]).to.equal('Acme Corp,"Sales, Marketing"');
        });

        it('should quote fields containing double quotes and escape them', function () {
            const matrix = [
                ['Name', 'Note'],
                ['Test', 'He said "hello"'],
            ];

            const result = formatCsv(matrix);
            const lines = result.split('\r\n');
            expect(lines[1]).to.equal('Test,"He said ""hello"""');
        });

        it('should quote fields containing newlines', function () {
            const matrix = [
                ['Name', 'Description'],
                ['Test', 'Line 1\nLine 2'],
            ];

            const result = formatCsv(matrix);
            expect(result).to.contain('"Line 1\nLine 2"');
        });

        it('should quote fields containing carriage returns', function () {
            const matrix = [
                ['Name', 'Description'],
                ['Test', 'Line 1\rLine 2'],
            ];

            const result = formatCsv(matrix);
            expect(result).to.contain('"Line 1\rLine 2"');
        });

        it('should handle null and undefined cell values as empty strings', function () {
            const matrix = [
                ['Name', 'Value'],
                ['Test', null],
                [undefined, 'Data'],
            ];

            const result = formatCsv(matrix);
            const lines = result.split('\r\n');
            expect(lines[1]).to.equal('Test,');
            expect(lines[2]).to.equal(',Data');
        });

        it('should handle numeric values', function () {
            const matrix = [
                ['Name', 'Amount'],
                ['Test', 1234.56],
            ];

            const result = formatCsv(matrix);
            const lines = result.split('\r\n');
            expect(lines[1]).to.equal('Test,1234.56');
        });

        it('should handle boolean values', function () {
            const matrix = [
                ['Name', 'Active'],
                ['Test', true],
                ['Other', false],
            ];

            const result = formatCsv(matrix);
            const lines = result.split('\r\n');
            expect(lines[1]).to.equal('Test,true');
            expect(lines[2]).to.equal('Other,false');
        });

        it('should use CRLF line endings per RFC 4180', function () {
            const matrix = [
                ['A', 'B'],
                ['1', '2'],
                ['3', '4'],
            ];

            const result = formatCsv(matrix);
            // Should contain CRLF between rows
            expect(result).to.contain('\r\n');
            // Should not have trailing CRLF
            expect(result).to.not.match(/\r\n$/);
        });

        it('should handle a field that is just a double quote', function () {
            const matrix = [
                ['Name', 'Value'],
                ['Test', '"'],
            ];

            const result = formatCsv(matrix);
            const lines = result.split('\r\n');
            expect(lines[1]).to.equal('Test,""""');
        });

        it('should handle empty string fields without quoting', function () {
            const matrix = [
                ['Name', 'Value'],
                ['Test', ''],
            ];

            const result = formatCsv(matrix);
            const lines = result.split('\r\n');
            expect(lines[1]).to.equal('Test,');
        });

        it('should handle rows with different lengths', function () {
            const matrix = [
                ['A', 'B', 'C'],
                ['1', '2'],
                ['x', 'y', 'z', 'extra'],
            ];

            const result = formatCsv(matrix);
            const lines = result.split('\r\n');
            expect(lines[0]).to.equal('A,B,C');
            expect(lines[1]).to.equal('1,2');
            expect(lines[2]).to.equal('x,y,z,extra');
        });
    });
});
