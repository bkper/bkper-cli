import { expect, setupTestEnvironment, getTestPaths } from '../../helpers/test-setup.js';
import { AppData } from '../../helpers/mock-interfaces.js';
import { setupMocks, createMockBkperForApps, setMockBkper } from '../../helpers/mock-factory.js';
import { loadApps } from '../../helpers/fixture-loader.js';

const { __dirname } = getTestPaths(import.meta.url);

// Load test data
const mockApps: AppData[] = loadApps(__dirname);

// Setup mocks before importing CLI module
setupMocks();

// Import the listApps function
const { listApps } = await import('../../../../src/commands/apps/index.js');

describe('CLI - apps list Command', function () {
    beforeEach(function () {
        setupTestEnvironment();
        const mockBkper = createMockBkperForApps(mockApps);
        setMockBkper(mockBkper);
    });

    it('should return all apps the user has access to', async function () {
        const result = await listApps();

        expect(result).to.be.an('array');
        expect(result).to.have.length(3);
    });

    it('should return app data with essential properties', async function () {
        const result = await listApps();

        const firstApp = result[0];
        expect(firstApp).to.have.property('id');
        expect(firstApp).to.have.property('name');
        expect(firstApp).to.have.property('published');
    });

    it('should include both published and unpublished apps', async function () {
        const result = await listApps();

        const publishedApps = result.filter((app: AppData) => app.published === true);
        const unpublishedApps = result.filter((app: AppData) => app.published === false);

        expect(publishedApps).to.have.length(2);
        expect(unpublishedApps).to.have.length(1);
    });

    it('should return empty array when user has no apps', async function () {
        // Setup mock with empty apps list
        const emptyMockBkper = createMockBkperForApps([]);
        setMockBkper(emptyMockBkper);

        const result = await listApps();

        expect(result).to.be.an('array');
        expect(result).to.have.length(0);
    });

    it('should preserve app metadata including owner and events', async function () {
        const result = await listApps();

        const taxBot = result.find((app: AppData) => app.id === 'app-tax-bot');
        expect(taxBot).to.exist;
        expect(taxBot!.ownerName).to.equal('Bkper');
        expect(taxBot!.events).to.include('TRANSACTION_POSTED');
    });
});
