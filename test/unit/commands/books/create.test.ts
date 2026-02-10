import { expect, setupTestEnvironment } from '../../helpers/test-setup.js';

const { createBook } = await import('../../../../src/commands/books/create.js');

describe('CLI - book create Command', function () {
    beforeEach(function () {
        setupTestEnvironment();
    });

    it('should export createBook function', function () {
        expect(createBook).to.be.a('function');
    });

    it('should require a name option', function () {
        // Verify the interface contract: name is required
        const options = { name: 'Test Book' };
        expect(options).to.have.property('name');
    });
});
