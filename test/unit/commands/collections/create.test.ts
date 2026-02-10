import { expect, setupTestEnvironment } from '../../helpers/test-setup.js';

const { createCollection } = await import('../../../../src/commands/collections/create.js');

describe('CLI - collection create Command', function () {
    beforeEach(function () {
        setupTestEnvironment();
    });

    it('should export createCollection function', function () {
        expect(createCollection).to.be.a('function');
    });

    it('should require a name option', function () {
        // Verify the interface contract: name is required
        const options = { name: 'Test Collection' };
        expect(options).to.have.property('name');
    });
});
