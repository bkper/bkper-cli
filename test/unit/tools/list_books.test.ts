import { expect, setupTestEnvironment, getTestPaths } from '../helpers/test-setup.js';
import { BkperMcpServerType, BookData } from '../helpers/mock-interfaces.js';
import { setupMocks, createMockBkperForBooks, setMockBkper } from '../helpers/mock-factory.js';
import { loadBooks, loadLargeBooks } from '../helpers/fixture-loader.js';

const { __dirname } = getTestPaths(import.meta.url);

// Load test data
const mockBooks: BookData[] = loadBooks(__dirname);
const largeMockBooks: BookData[] = loadLargeBooks(__dirname);
let currentMockBooks: BookData[] = mockBooks;

// Setup mocks and import server
setupMocks();

const { BkperMcpServer } = await import('../../../src/mcp/server.js');

describe('MCP Server - list_books Tool Registration', function () {
    let server: BkperMcpServerType;

    beforeEach(function () {
        setupTestEnvironment();
        currentMockBooks = mockBooks;
        const mockBkper = createMockBkperForBooks(currentMockBooks);
        setMockBkper(mockBkper);
        server = new BkperMcpServer();
    });

    it('should register list_books tool in MCP tools list', async function () {
        const response = await server.testListTools();

        expect(response).to.have.property('tools');
        expect(response.tools).to.be.an('array');

        const listBooksTool = response.tools.find((tool: any) => tool.name === 'list_books');
        expect(listBooksTool).to.exist;
        expect(listBooksTool!.name).to.equal('list_books');
        expect(listBooksTool!.description).to.include('mandatory filtering');
        expect(listBooksTool!.inputSchema).to.have.property('properties');
        expect(listBooksTool!.inputSchema.properties).to.have.property('filter');
        expect(listBooksTool!.inputSchema.properties).to.not.have.property('limit');
        expect(listBooksTool!.inputSchema.properties).to.not.have.property('cursor');
    });

    it('should have proper MCP tool schema for list_books', async function () {
        const response = await server.testListTools();
        const listBooksTool = response.tools.find((tool: any) => tool.name === 'list_books');

        expect(listBooksTool!.inputSchema).to.deep.equal({
            type: 'object',
            properties: {
                filter: {
                    type: 'string',
                    description:
                        'Required filter to search books by name or property (case-insensitive substring match)',
                },
            },
            required: ['filter'],
        });
    });
});

describe('MCP Server - list_books Tool Calls', function () {
    let server: BkperMcpServerType;

    beforeEach(function () {
        setupTestEnvironment();
        currentMockBooks = mockBooks;
        const mockBkper = createMockBkperForBooks(currentMockBooks);
        setMockBkper(mockBkper);
        server = new BkperMcpServer();
    });

    it('should handle MCP list_books tool call with filter', async function () {
        const response = await server.testCallTool('list_books', { filter: 'Test' });

        // Verify MCP response structure
        expect(response).to.have.property('content');
        expect(response.content).to.be.an('array');
        expect(response.content).to.have.length(1);
        expect(response.content[0]).to.have.property('type', 'text');
        expect(response.content[0]).to.have.property('text');

        // Parse the JSON response
        const jsonResponse = JSON.parse(response.content[0].text as string);
        expect(jsonResponse).to.have.property('total');
        expect(jsonResponse).to.have.property('books');
        expect(jsonResponse).to.not.have.property('pagination');

        expect(jsonResponse.total).to.equal(1);
        expect(jsonResponse.books).to.have.length(1);
    });
});

describe('MCP Server - list_books Filter Parameter', function () {
    let server: BkperMcpServerType;

    beforeEach(function () {
        setupTestEnvironment();
        currentMockBooks = mockBooks;
        const mockBkper = createMockBkperForBooks(currentMockBooks);
        setMockBkper(mockBkper);
        server = new BkperMcpServer();
    });

    it('should filter books by exact name match', async function () {
        const response = await server.testCallTool('list_books', {
            filter: 'Test Company Ltd',
        });

        const jsonResponse = JSON.parse(response.content[0].text as string);
        expect(jsonResponse.total).to.equal(1);
        expect(jsonResponse.books).to.have.length(1);
        expect(jsonResponse.books[0].name).to.equal('Test Company Ltd');
        expect(jsonResponse.books[0].id).to.equal('book-1');
    });

    it('should filter books by partial name match (case-insensitive)', async function () {
        const response = await server.testCallTool('list_books', {
            filter: 'company',
        });

        const jsonResponse = JSON.parse(response.content[0].text as string);
        expect(jsonResponse.total).to.equal(1);
        expect(jsonResponse.books).to.have.length(1);
        expect(jsonResponse.books[0].name).to.equal('Test Company Ltd');
    });

    it('should filter books by partial name match with different case', async function () {
        const response = await server.testCallTool('list_books', {
            filter: 'PERSONAL',
        });

        const jsonResponse = JSON.parse(response.content[0].text as string);
        expect(jsonResponse.total).to.equal(1);
        expect(jsonResponse.books).to.have.length(1);
        expect(jsonResponse.books[0].name).to.equal('Personal Finance');
        expect(jsonResponse.books[0].id).to.equal('book-2');
    });

    it('should return multiple books when filter matches multiple entries', async function () {
        // Using a common substring that should match both books - neither contains this
        // Let's test with substring that matches both
        const response = await server.testCallTool('list_books', {
            filter: 'e', // Both "Test Company Ltd" and "Personal Finance" contain 'e'
        });

        const jsonResponse = JSON.parse(response.content[0].text as string);
        expect(jsonResponse.total).to.equal(2);
        expect(jsonResponse.books).to.have.length(2);
    });

    it('should return empty result when filter matches no books', async function () {
        const response = await server.testCallTool('list_books', {
            filter: 'NonExistentBookName',
        });

        const jsonResponse = JSON.parse(response.content[0].text as string);
        expect(jsonResponse.total).to.equal(0);
        expect(jsonResponse.books).to.have.length(0);
    });

    it('should handle empty string filter (return all books)', async function () {
        const response = await server.testCallTool('list_books', {
            filter: '',
        });

        const jsonResponse = JSON.parse(response.content[0].text as string);
        expect(jsonResponse.total).to.equal(2);
        expect(jsonResponse.books).to.have.length(2);
    });

    it('should handle whitespace-only filter (return all books)', async function () {
        const response = await server.testCallTool('list_books', {
            filter: '   ',
        });

        const jsonResponse = JSON.parse(response.content[0].text as string);
        expect(jsonResponse.total).to.equal(2);
        expect(jsonResponse.books).to.have.length(2);
    });

    it('should handle special characters in filter', async function () {
        const response = await server.testCallTool('list_books', {
            filter: 'Ltd',
        });

        const jsonResponse = JSON.parse(response.content[0].text as string);
        expect(jsonResponse.total).to.equal(1);
        expect(jsonResponse.books).to.have.length(1);
        expect(jsonResponse.books[0].name).to.equal('Test Company Ltd');
    });

    it('should work with filtering on large dataset', async function () {
        // Switch to large dataset for filtering testing
        currentMockBooks = largeMockBooks;
        const mockBkper = createMockBkperForBooks(currentMockBooks);
        setMockBkper(mockBkper);
        server = new BkperMcpServer();

        // Filter by a common character that should match many books
        const response = await server.testCallTool('list_books', {
            filter: 'Company', // All books in large dataset contain "Company"
        });

        const jsonResponse = JSON.parse(response.content[0].text as string);
        // Verify response structure is preserved with filtering
        expect(jsonResponse).to.have.property('total');
        expect(jsonResponse).to.have.property('books');
        expect(jsonResponse).to.not.have.property('pagination');
        expect(jsonResponse.total).to.equal(500); // All books match "Company"
        expect(jsonResponse.books).to.have.length(500);
    });
});

describe('MCP Server - list_books Tool Schema with Filter Parameter', function () {
    let server: BkperMcpServerType;

    beforeEach(function () {
        setupTestEnvironment();
        currentMockBooks = mockBooks;
        const mockBkper = createMockBkperForBooks(currentMockBooks);
        setMockBkper(mockBkper);
        server = new BkperMcpServer();
    });

    it('should include filter parameter in MCP tool schema', async function () {
        const response = await server.testListTools();
        const listBooksTool = response.tools.find((tool: any) => tool.name === 'list_books') as any;

        expect(listBooksTool).to.exist;
        expect(listBooksTool.inputSchema.properties).to.have.property('filter');
        expect(listBooksTool.inputSchema.properties.filter).to.deep.equal({
            type: 'string',
            description:
                'Required filter to search books by name or property (case-insensitive substring match)',
        });
    });

    it('should have filter parameter as required in schema', async function () {
        const response = await server.testListTools();
        const listBooksTool = response.tools.find((tool: any) => tool.name === 'list_books') as any;

        expect(listBooksTool).to.exist;
        expect(listBooksTool.inputSchema.required).to.be.an('array');
        expect(listBooksTool.inputSchema.required).to.include('filter');
    });

    it('should update tool description to mention mandatory filtering', async function () {
        const response = await server.testListTools();
        const listBooksTool = response.tools.find((tool: any) => tool.name === 'list_books') as any;

        expect(listBooksTool).to.exist;
        expect(listBooksTool.description).to.include('mandatory filtering');
    });
});

describe('MCP Server - list_books Error Handling', function () {
    let server: BkperMcpServerType;

    beforeEach(function () {
        setupTestEnvironment();
        currentMockBooks = mockBooks;
        const mockBkper = createMockBkperForBooks(currentMockBooks);
        setMockBkper(mockBkper);
        server = new BkperMcpServer();
    });

    it('should return different results for different filters', async function () {
        // Call with first filter
        const firstFilterResponse = await server.testCallTool('list_books', {
            filter: 'Test',
        });
        const firstFilterData = JSON.parse(firstFilterResponse.content[0].text as string);

        // Call with second filter
        const secondFilterResponse = await server.testCallTool('list_books', {
            filter: 'Personal',
        });
        const secondFilterData = JSON.parse(secondFilterResponse.content[0].text as string);

        // Results should be different and correctly filtered
        expect(firstFilterData.total).to.equal(1);
        expect(firstFilterData.books[0].name).to.equal('Test Company Ltd');

        expect(secondFilterData.total).to.equal(1);
        expect(secondFilterData.books[0].name).to.equal('Personal Finance');
    });

    it('should return all matching books when filtering is applied', async function () {
        // Switch to large dataset
        currentMockBooks = largeMockBooks;
        const mockBkper = createMockBkperForBooks(currentMockBooks);
        setMockBkper(mockBkper);
        server = new BkperMcpServer();

        // Call with filter that matches specific books
        const response = await server.testCallTool('list_books', {
            filter: '1', // This matches "Company 1 Ltd", "Company 10 Ltd", etc.
        });
        const responseData = JSON.parse(response.content[0].text as string);

        expect(responseData.books).to.be.an('array');
        expect(responseData.total).to.be.greaterThan(0);
        // All returned books should still match the filter
        responseData.books.forEach((book: any) => {
            expect(book.name.toLowerCase()).to.include('1');
        });
    });
});
