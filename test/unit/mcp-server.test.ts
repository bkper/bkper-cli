import { expect, setupTestEnvironment, getTestPaths } from './helpers/test-setup.js';
import { BkperMcpServerType, BookData } from './helpers/mock-interfaces.js';
import { setupMocks, createMockBkperForBooks, setMockBkper } from './helpers/mock-factory.js';
import { loadBooks } from './helpers/fixture-loader.js';

const { __dirname } = getTestPaths(import.meta.url);

// Load test data
const mockBooks: BookData[] = loadBooks(__dirname);
let currentMockBooks: BookData[] = mockBooks;

// Setup mocks and import server
setupMocks();
setMockBkper(createMockBkperForBooks(currentMockBooks));

const { BkperMcpServer } = await import('../../src/mcp/server.js');

describe('MCP Server - General Tests', function () {
    let server: BkperMcpServerType;

    beforeEach(function () {
        setupTestEnvironment();
        currentMockBooks = mockBooks;
        const mockBkper = createMockBkperForBooks(currentMockBooks);
        setMockBkper(mockBkper);
        server = new BkperMcpServer();
    });

    it('should return proper MCP error for unknown tool', async function () {
        try {
            await server.testCallTool('unknown_tool');
            expect.fail('Should have thrown an error');
        } catch (error) {
            expect(error).to.be.an('error');
            expect((error as Error).message).to.include('Unknown tool');
        }
    });

    it('should have testListTools helper method for testing', async function () {
        const response = await server.testListTools();

        expect(response).to.have.property('tools');
        expect(response.tools).to.be.an('array');
        expect(response.tools.length).to.be.greaterThan(0);
    });

    it('should have testCallTool helper method for testing', async function () {
        // Test that the helper method exists and works with any tool
        expect(server.testCallTool).to.be.a('function');

        // This should throw an error for unknown tool, proving the method works
        try {
            await server.testCallTool('non_existent_tool');
            expect.fail('Should have thrown an error');
        } catch (error) {
            expect(error).to.be.an('error');
        }
    });
});
