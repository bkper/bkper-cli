import { expect } from '../../unit/helpers/test-setup.js';
import { detectInputFormat } from '../../../src/input/format-detector.js';

describe('format-detector', function () {
    describe('detectInputFormat', function () {
        it('should detect JSON object', function () {
            expect(detectInputFormat('{"name": "Test"}')).to.equal('json');
        });

        it('should detect JSON array', function () {
            expect(detectInputFormat('[{"name": "Test"}]')).to.equal('json');
        });

        it('should detect JSON with leading whitespace', function () {
            expect(detectInputFormat('  \n  {"name": "Test"}')).to.equal('json');
            expect(detectInputFormat('\t[{"name": "Test"}]')).to.equal('json');
        });

        it('should detect CSV for header row content', function () {
            expect(detectInputFormat('Name,Type,Amount\nChecking,ASSET,1000')).to.equal('csv');
        });

        it('should detect CSV for plain text content', function () {
            expect(detectInputFormat('hello world')).to.equal('csv');
        });

        it('should detect CSV for content starting with a letter', function () {
            expect(detectInputFormat('Date,Description,Amount')).to.equal('csv');
        });

        it('should detect CSV for content starting with a number', function () {
            expect(detectInputFormat('2024-01-01,Payment,100')).to.equal('csv');
        });

        it('should detect CSV for content starting with a quote', function () {
            expect(detectInputFormat('"Name","Type"\n"Test","ASSET"')).to.equal('csv');
        });

        it('should detect CSV for empty-ish content', function () {
            expect(detectInputFormat('')).to.equal('csv');
            expect(detectInputFormat('   ')).to.equal('csv');
        });
    });
});
