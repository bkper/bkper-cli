import { expect } from '../../unit/helpers/test-setup.js';
import { formatTable, formatItem } from '../../../src/render/table-formatter.js';

describe('table-formatter', function () {
    describe('formatTable', function () {
        it('should format a simple matrix with aligned columns', function () {
            const matrix = [
                ['Name', 'Type', 'Parent'],
                ['Revenue', 'INCOMING', ''],
                ['Expenses', 'OUTGOING', ''],
            ];

            const result = formatTable(matrix);
            const lines = result.split('\n');

            // Header line
            expect(lines[0]).to.contain('Name');
            expect(lines[0]).to.contain('Type');
            expect(lines[0]).to.contain('Parent');
            // Divider line
            expect(lines[1]).to.match(/^_+$/);
            // Data lines
            expect(lines[2]).to.contain('Revenue');
            expect(lines[2]).to.contain('INCOMING');
            expect(lines[3]).to.contain('Expenses');
            expect(lines[3]).to.contain('OUTGOING');
        });

        it('should align columns by padding to max width', function () {
            const matrix = [
                ['Name', 'Value'],
                ['A', '100'],
                ['Long Name Here', '5'],
            ];

            const result = formatTable(matrix);
            const lines = result.split('\n');

            // Both data lines should have the same position for Value column
            const headerValueIndex = lines[0].indexOf('Value');
            const row1ValueIndex = lines[2].indexOf('100');
            const row2ValueIndex = lines[3].indexOf('5');

            expect(headerValueIndex).to.equal(row1ValueIndex);
            expect(headerValueIndex).to.equal(row2ValueIndex);
        });

        it('should return empty string for empty matrix', function () {
            const result = formatTable([]);
            expect(result).to.equal('');
        });

        it('should render a single-row matrix as header with divider', function () {
            const result = formatTable([['Total Equity', '-1753687.09']]);
            const lines = result.split('\n');

            expect(lines).to.have.length(2);
            expect(lines[0]).to.contain('Total Equity');
            expect(lines[0]).to.contain('-1753687.09');
            expect(lines[1]).to.match(/^_+$/);
        });

        it('should render headerless multi-row matrices', function () {
            const matrix = [
                ['Bank Account', '43636.46'],
                ['Petty Cash', '-791728.42'],
                ['Broker', '1731135.21'],
            ];

            const result = formatTable(matrix);
            const lines = result.split('\n');

            // Row 0 treated as header, divider, then 2 data rows
            expect(lines).to.have.length(4);
            expect(lines[0]).to.contain('Bank Account');
            expect(lines[0]).to.contain('43636.46');
            expect(lines[2]).to.contain('Petty Cash');
            expect(lines[3]).to.contain('Broker');
        });

        it('should handle null and undefined values as empty strings', function () {
            const matrix = [
                ['Name', 'Value'],
                ['Test', null],
                [undefined, '123'],
            ];

            const result = formatTable(matrix);
            const lines = result.split('\n');

            // Should not throw and should have 4 lines (header + divider + 2 data)
            expect(lines).to.have.length(4);
            expect(lines[2]).to.contain('Test');
            expect(lines[3]).to.contain('123');
        });

        it('should handle numeric values by converting to string', function () {
            const matrix = [
                ['Name', 'Amount', 'Count'],
                ['Item', 1234.56, 42],
            ];

            const result = formatTable(matrix);
            expect(result).to.contain('1234.56');
            expect(result).to.contain('42');
        });

        it('should use 2-space column separator', function () {
            const matrix = [
                ['A', 'B'],
                ['x', 'y'],
            ];

            const result = formatTable(matrix);
            const lines = result.split('\n');

            // Column A is 1 char wide, so 'B' should start at index 3 (1 char + 2 spaces)
            expect(lines[0]).to.equal('A  B');
            expect(lines[2]).to.equal('x  y');
        });

        it('should produce a full-width continuous underscore divider', function () {
            const matrix = [
                ['Name', 'Type'],
                ['Test', 'ASSET'],
            ];

            const result = formatTable(matrix);
            const lines = result.split('\n');
            const divider = lines[1];

            // Divider should be only underscores
            expect(divider).to.match(/^_+$/);
            // Divider should span the full width of the header
            expect(divider.length).to.equal(lines[0].length);
        });

        it('should handle single-column matrix', function () {
            const matrix = [['Name'], ['Alice'], ['Bob']];

            const result = formatTable(matrix);
            const lines = result.split('\n');

            expect(lines[0]).to.equal('Name');
            expect(lines[1]).to.match(/^_+$/);
            expect(lines[2]).to.equal('Alice');
            expect(lines[3]).to.equal('Bob');
        });

        describe('cell truncation', function () {
            it('should truncate data cells exceeding 40 characters', function () {
                const longValue = 'A'.repeat(50);
                const matrix = [['Name'], [longValue]];

                const result = formatTable(matrix);
                const lines = result.split('\n');
                const dataCell = lines[2];

                expect(dataCell).to.have.length(40);
                expect(dataCell.endsWith('…')).to.be.true;
                expect(dataCell).to.equal('A'.repeat(39) + '…');
            });

            it('should not truncate data cells at exactly 40 characters', function () {
                const exactValue = 'B'.repeat(40);
                const matrix = [['Name'], [exactValue]];

                const result = formatTable(matrix);
                const lines = result.split('\n');

                expect(lines[2]).to.equal(exactValue);
            });

            it('should not truncate data cells shorter than 40 characters', function () {
                const shortValue = 'C'.repeat(20);
                const matrix = [['Name'], [shortValue]];

                const result = formatTable(matrix);
                const lines = result.split('\n');

                expect(lines[2]).to.equal(shortValue);
            });

            it('should never truncate header cells even if longer than 40 characters', function () {
                const longHeader = 'H'.repeat(50);
                const matrix = [[longHeader], ['data']];

                const result = formatTable(matrix);
                const lines = result.split('\n');

                expect(lines[0]).to.equal(longHeader);
                expect(lines[0]).to.have.length(50);
            });
        });
    });

    describe('formatItem', function () {
        it('should format a record as key-value pairs', function () {
            const item: Record<string, unknown> = {
                name: 'Checking',
                type: 'ASSET',
                archived: false,
            };

            const result = formatItem(item);
            const lines = result.split('\n');

            expect(lines).to.have.length(3);
            expect(lines[0]).to.contain('name:');
            expect(lines[0]).to.contain('Checking');
            expect(lines[1]).to.contain('type:');
            expect(lines[1]).to.contain('ASSET');
            expect(lines[2]).to.contain('archived:');
            expect(lines[2]).to.contain('false');
        });

        it('should align values with padding after keys', function () {
            const item: Record<string, unknown> = {
                id: '123',
                longPropertyName: 'value',
            };

            const result = formatItem(item);
            const lines = result.split('\n');

            // Both values should start at the same column
            const value1Start = lines[0].indexOf('123');
            const value2Start = lines[1].indexOf('value');

            expect(value1Start).to.equal(value2Start);
        });

        it('should handle null and undefined values', function () {
            const item: Record<string, unknown> = {
                name: 'Test',
                value: null,
                other: undefined,
            };

            const result = formatItem(item);
            expect(result).to.contain('name:');
            expect(result).to.contain('Test');
        });

        it('should skip null and undefined values', function () {
            const item: Record<string, unknown> = {
                name: 'Test',
                empty: null,
                missing: undefined,
            };

            const result = formatItem(item);
            const lines = result.split('\n');

            expect(lines).to.have.length(1);
            expect(lines[0]).to.contain('name:');
        });

        it('should render nested objects with indented key-value pairs', function () {
            const item: Record<string, unknown> = {
                name: 'Test',
                properties: { key: 'value', other: 'data' },
            };

            const result = formatItem(item);
            const lines = result.split('\n');

            expect(lines[0]).to.contain('name:');
            expect(lines[0]).to.contain('Test');
            expect(lines[1]).to.equal('properties:');
            expect(lines[2]).to.match(/^\s+key:/);
            expect(lines[2]).to.contain('value');
            expect(lines[3]).to.match(/^\s+other:/);
            expect(lines[3]).to.contain('data');
        });

        it('should align nested object keys independently', function () {
            const item: Record<string, unknown> = {
                name: 'Test',
                collection: { id: '123', longFieldName: 'val' },
            };

            const result = formatItem(item);
            const lines = result.split('\n');

            // id and longFieldName lines should have values aligned within the nested block
            const idValueStart = lines[2].indexOf('123');
            const longValueStart = lines[3].indexOf('val');

            expect(idValueStart).to.equal(longValueStart);
        });

        it('should render arrays of primitives with dash prefix', function () {
            const item: Record<string, unknown> = {
                name: 'Test',
                tags: ['tag1', 'tag2', 'tag3'],
            };

            const result = formatItem(item);
            const lines = result.split('\n');

            expect(lines[0]).to.contain('name:');
            expect(lines[1]).to.equal('tags:');
            expect(lines[2]).to.match(/^\s+- tag1$/);
            expect(lines[3]).to.match(/^\s+- tag2$/);
            expect(lines[4]).to.match(/^\s+- tag3$/);
        });

        it('should render arrays of objects with dash prefix and indented fields', function () {
            const item: Record<string, unknown> = {
                name: 'Book',
                groups: [
                    { name: 'Assets', type: 'ASSET' },
                    { name: 'Liabilities', type: 'LIABILITY' },
                ],
            };

            const result = formatItem(item);
            const lines = result.split('\n');

            expect(lines[0]).to.contain('name:');
            expect(lines[0]).to.contain('Book');
            expect(lines[1]).to.equal('groups:');
            // First array element
            expect(lines[2]).to.match(/^\s+- name:/);
            expect(lines[2]).to.contain('Assets');
            expect(lines[3]).to.match(/^\s+type:/);
            expect(lines[3]).to.contain('ASSET');
            // Second array element
            expect(lines[4]).to.match(/^\s+- name:/);
            expect(lines[4]).to.contain('Liabilities');
            expect(lines[5]).to.match(/^\s+type:/);
            expect(lines[5]).to.contain('LIABILITY');
        });

        it('should handle deep nesting (object within object)', function () {
            const item: Record<string, unknown> = {
                name: 'Child Group',
                parent: {
                    name: 'Parent Group',
                    parent: {
                        name: 'Grandparent',
                    },
                },
            };

            const result = formatItem(item);
            const lines = result.split('\n');

            expect(lines[0]).to.contain('name:');
            expect(lines[0]).to.contain('Child Group');
            expect(lines[1]).to.equal('parent:');
            expect(lines[2]).to.contain('name:');
            expect(lines[2]).to.contain('Parent Group');
            expect(lines[3]).to.match(/^\s+parent:$/);
            expect(lines[4]).to.contain('name:');
            expect(lines[4]).to.contain('Grandparent');
        });

        it('should skip empty arrays', function () {
            const item: Record<string, unknown> = {
                name: 'Test',
                tags: [],
            };

            const result = formatItem(item);
            const lines = result.split('\n');

            expect(lines).to.have.length(1);
            expect(result).to.not.contain('tags');
        });

        it('should skip empty objects', function () {
            const item: Record<string, unknown> = {
                name: 'Test',
                properties: {},
            };

            const result = formatItem(item);
            const lines = result.split('\n');

            expect(lines).to.have.length(1);
            expect(result).to.not.contain('properties');
        });

        it('should render a realistic book object correctly', function () {
            const item: Record<string, unknown> = {
                id: 'abc123',
                name: 'My Book',
                ownerName: 'mael',
                permission: 'OWNER',
                visibility: 'PRIVATE',
                collection: {
                    id: 'col-456',
                    name: 'My Collection',
                },
                properties: {
                    stock_book: 'true',
                    report_url: 'https://example.com',
                },
            };

            const result = formatItem(item);

            // Top-level primitives rendered inline
            expect(result).to.contain('id:');
            expect(result).to.contain('abc123');
            expect(result).to.contain('name:');
            expect(result).to.contain('My Book');

            // collection rendered as nested block
            expect(result).to.contain('collection:\n');
            expect(result).to.contain('col-456');
            expect(result).to.contain('My Collection');

            // properties rendered as nested block
            expect(result).to.contain('properties:\n');
            expect(result).to.contain('stock_book:');
            expect(result).to.contain('true');
            expect(result).to.contain('report_url:');
            expect(result).to.contain('https://example.com');
        });

        it('should return empty string for empty record', function () {
            const result = formatItem({});
            expect(result).to.equal('');
        });
    });
});
