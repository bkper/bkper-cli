import { expect } from '../../unit/helpers/test-setup.js';
import { parseCsv } from '../../../src/input/csv-parser.js';

describe('csv-parser', function () {
    describe('parseCsv', function () {
        it('should parse simple CSV with headers', function () {
            const csv = 'Name,Type,Amount\nChecking,ASSET,1000\nRevenue,INCOMING,5000';
            const result = parseCsv(csv);

            expect(result).to.have.length(2);
            expect(result[0]).to.deep.equal({ Name: 'Checking', Type: 'ASSET', Amount: '1000' });
            expect(result[1]).to.deep.equal({ Name: 'Revenue', Type: 'INCOMING', Amount: '5000' });
        });

        it('should return empty array for empty content', function () {
            expect(parseCsv('')).to.deep.equal([]);
        });

        it('should return empty array for header-only CSV', function () {
            const csv = 'Name,Type,Amount\n';
            const result = parseCsv(csv);
            expect(result).to.deep.equal([]);
        });

        it('should handle CRLF line endings', function () {
            const csv = 'Name,Type\r\nChecking,ASSET\r\nRevenue,INCOMING';
            const result = parseCsv(csv);

            expect(result).to.have.length(2);
            expect(result[0]).to.deep.equal({ Name: 'Checking', Type: 'ASSET' });
            expect(result[1]).to.deep.equal({ Name: 'Revenue', Type: 'INCOMING' });
        });

        it('should handle quoted fields', function () {
            const csv = 'Name,Description\nTest,"A long, detailed description"';
            const result = parseCsv(csv);

            expect(result).to.have.length(1);
            expect(result[0]).to.deep.equal({
                Name: 'Test',
                Description: 'A long, detailed description',
            });
        });

        it('should handle escaped double quotes within quoted fields', function () {
            const csv = 'Name,Note\nTest,"He said ""hello"""\n';
            const result = parseCsv(csv);

            expect(result).to.have.length(1);
            expect(result[0]).to.deep.equal({
                Name: 'Test',
                Note: 'He said "hello"',
            });
        });

        it('should handle newlines within quoted fields', function () {
            const csv = 'Name,Description\nTest,"Line 1\nLine 2"';
            const result = parseCsv(csv);

            expect(result).to.have.length(1);
            expect(result[0]).to.deep.equal({
                Name: 'Test',
                Description: 'Line 1\nLine 2',
            });
        });

        it('should handle CRLF within quoted fields', function () {
            const csv = 'Name,Description\r\nTest,"Line 1\r\nLine 2"';
            const result = parseCsv(csv);

            expect(result).to.have.length(1);
            expect(result[0]).to.deep.equal({
                Name: 'Test',
                Description: 'Line 1\r\nLine 2',
            });
        });

        it('should skip empty data rows', function () {
            const csv = 'Name,Type\nChecking,ASSET\n\nRevenue,INCOMING';
            const result = parseCsv(csv);

            expect(result).to.have.length(2);
            expect(result[0]).to.deep.equal({ Name: 'Checking', Type: 'ASSET' });
            expect(result[1]).to.deep.equal({ Name: 'Revenue', Type: 'INCOMING' });
        });

        it('should handle rows with fewer fields than headers', function () {
            const csv = 'Name,Type,Amount\nChecking,ASSET';
            const result = parseCsv(csv);

            expect(result).to.have.length(1);
            expect(result[0]).to.deep.equal({ Name: 'Checking', Type: 'ASSET', Amount: '' });
        });

        it('should trim header whitespace', function () {
            const csv = ' Name , Type \nChecking,ASSET';
            const result = parseCsv(csv);

            expect(result).to.have.length(1);
            expect(result[0]).to.deep.equal({ Name: 'Checking', Type: 'ASSET' });
        });

        it('should handle a single data row', function () {
            const csv = 'Name,Type\nChecking,ASSET';
            const result = parseCsv(csv);

            expect(result).to.have.length(1);
            expect(result[0]).to.deep.equal({ Name: 'Checking', Type: 'ASSET' });
        });

        it('should handle fields with only spaces', function () {
            const csv = 'Name,Type\n   ,ASSET';
            const result = parseCsv(csv);

            expect(result).to.have.length(1);
            expect(result[0]).to.deep.equal({ Name: '   ', Type: 'ASSET' });
        });

        it('should handle many columns', function () {
            const csv = 'A,B,C,D,E\n1,2,3,4,5';
            const result = parseCsv(csv);

            expect(result).to.have.length(1);
            expect(result[0]).to.deep.equal({ A: '1', B: '2', C: '3', D: '4', E: '5' });
        });

        it('should handle a trailing comma as an empty field', function () {
            const csv = 'Name,Type\nChecking,\n';
            const result = parseCsv(csv);

            expect(result).to.have.length(1);
            expect(result[0]).to.deep.equal({ Name: 'Checking', Type: '' });
        });

        it('should handle real-world bank export style CSV', function () {
            const csv = [
                'Date,Description,Amount,Category',
                '2024-01-15,"Coffee Shop - ""The Bean""",4.50,Food',
                '2024-01-16,"Rent, January",1200.00,Housing',
                '2024-01-17,Salary,5000.00,Income',
            ].join('\n');

            const result = parseCsv(csv);

            expect(result).to.have.length(3);
            expect(result[0]).to.deep.equal({
                Date: '2024-01-15',
                Description: 'Coffee Shop - "The Bean"',
                Amount: '4.50',
                Category: 'Food',
            });
            expect(result[1]).to.deep.equal({
                Date: '2024-01-16',
                Description: 'Rent, January',
                Amount: '1200.00',
                Category: 'Housing',
            });
            expect(result[2]).to.deep.equal({
                Date: '2024-01-17',
                Description: 'Salary',
                Amount: '5000.00',
                Category: 'Income',
            });
        });

        it('should handle quoted headers', function () {
            const csv = '"Name","Type"\nChecking,ASSET';
            const result = parseCsv(csv);

            expect(result).to.have.length(1);
            expect(result[0]).to.deep.equal({ Name: 'Checking', Type: 'ASSET' });
        });
    });
});
