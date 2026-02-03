import { expect, setupTestEnvironment, getTestPaths } from '../helpers/test-setup.js';
import { BkperMcpServerType, BookData, GroupData } from '../helpers/mock-interfaces.js';
import { setupMocks, createMockBkperForBook, setMockBkper } from '../helpers/mock-factory.js';
import { loadBooks } from '../helpers/fixture-loader.js';

const { __dirname } = getTestPaths(import.meta.url);

// Load test data
const mockBooks: BookData[] = loadBooks(__dirname);

// Transform fixture groups to GroupData format
function transformGroupsToGroupData(book: BookData): GroupData[] {
    if (!book.groups) return [];

    return book.groups.map((group: any) => ({
        id: group.id,
        name: group.name,
        type: group.type,
        hidden: group.hidden,
        permanent: group.permanent,
        parent: group.parent,
        properties: group.properties,
    }));
}

// Create a mock that returns book-specific groups
function createMockBkperForBookWithGroups(books: BookData[]) {
    return {
        setConfig: () => {},
        getBook: async (id: string) => {
            const book = books.find(b => b.id === id);
            if (!book) {
                throw new Error(`Book not found: ${id}`);
            }

            return {
                json: (): BookData => {
                    // Return book data without groups, since they'll be added by the tool
                    const { groups, ...bookWithoutGroups } = book;
                    return bookWithoutGroups as BookData;
                },
                getGroups: async () => {
                    const groupsData = transformGroupsToGroupData(book);

                    // Create mock groups with proper parent-child relationships
                    const groupMap = new Map();
                    const mockGroups: any[] = [];

                    // First pass: create all mock groups
                    groupsData.forEach((groupData: GroupData) => {
                        const mockGroup = {
                            getId: (): string => groupData.id || '',
                            getName: (): string => groupData.name || '',
                            getType: (): string => groupData.type || '',
                            isHidden: (): boolean => groupData.hidden || false,
                            isPermanent: (): boolean => groupData.permanent || false,
                            getParent: (): any => null, // Will be set in second pass
                            getChildren: (): any[] => [], // Will be populated in second pass
                            getProperties: (): { [name: string]: string } =>
                                groupData.properties || {},
                            json: (): GroupData => groupData,
                        };

                        mockGroups.push(mockGroup);
                        if (groupData.id) {
                            groupMap.set(groupData.id, mockGroup);
                        }
                    });

                    // Second pass: set up parent-child relationships
                    groupsData.forEach((groupData: GroupData, index: number) => {
                        const mockGroup = mockGroups[index];

                        // Set parent
                        if (groupData.parent?.id) {
                            const parent = groupMap.get(groupData.parent.id);
                            if (parent) {
                                mockGroup.getParent = () => parent;
                            }
                        }

                        // Set children
                        const children = mockGroups.filter(
                            (_, childIndex) => groupsData[childIndex].parent?.id === groupData.id
                        );
                        mockGroup.getChildren = () => children;
                    });

                    return mockGroups;
                },
            };
        },
    };
}

// Setup mocks and import server
setupMocks();

const { BkperMcpServer } = await import('../../../src/mcp/server.js');

describe('MCP Server - get_book Tool Registration', function () {
    let server: BkperMcpServerType;

    beforeEach(function () {
        setupTestEnvironment();
        // Clear any existing mock state
        delete (globalThis as any).__mockBkper;
        // Create a mock that returns book-specific groups
        const mockBkper = createMockBkperForBookWithGroups(mockBooks);
        setMockBkper(mockBkper);
        server = new BkperMcpServer();
    });

    it('should register get_book tool in MCP tools list', async function () {
        const response = await server.testListTools();

        const getBookTool = response.tools.find((tool: any) => tool.name === 'get_book');

        // This test will FAIL until get_book tool is implemented
        expect(getBookTool).to.exist;
        expect(getBookTool!.name).to.equal('get_book');
        expect(getBookTool!.description).to.include('detailed information');
        expect(getBookTool!.inputSchema).to.have.property('properties');
        expect(getBookTool!.inputSchema.properties).to.have.property('bookId');
        expect(getBookTool!.inputSchema.required).to.include('bookId');
    });

    it('should have proper MCP tool schema for get_book', async function () {
        const response = await server.testListTools();
        const getBookTool = response.tools.find((tool: any) => tool.name === 'get_book');

        // This test will FAIL until get_book tool is implemented
        expect(getBookTool).to.exist;
        expect(getBookTool!.inputSchema).to.deep.equal({
            type: 'object',
            properties: {
                bookId: {
                    type: 'string',
                    description: 'The unique identifier of the book to retrieve',
                },
            },
            required: ['bookId'],
        });
    });
});

describe('MCP Server - get_book Tool Calls', function () {
    let server: BkperMcpServerType;

    beforeEach(function () {
        setupTestEnvironment();
        // Clear any existing mock state
        delete (globalThis as any).__mockBkper;
        // Create a mock that returns book-specific groups
        const mockBkper = createMockBkperForBookWithGroups(mockBooks);
        setMockBkper(mockBkper);
        server = new BkperMcpServer();
    });

    it('should handle MCP get_book tool call for valid book ID', async function () {
        const response = await server.testCallTool('get_book', { bookId: 'book-1' });

        // Verify MCP response structure
        expect(response).to.have.property('content');
        expect(response.content).to.be.an('array');
        expect(response.content).to.have.length(1);
        expect(response.content[0]).to.have.property('type', 'text');
        expect(response.content[0]).to.have.property('text');

        // Parse the JSON response
        const jsonResponse = JSON.parse(response.content[0].text as string);
        expect(jsonResponse).to.have.property('book');
        expect(jsonResponse).to.have.property('readme');

        const book = jsonResponse.book;
        expect(book).to.have.property('id', 'book-1');
        expect(book).to.have.property('name', 'Test Company Ltd');
        expect(book).to.have.property('timeZone');
        expect(book).to.have.property('fractionDigits');
        expect(book).to.have.property('decimalSeparator');
        expect(book).to.have.property('datePattern');
        expect(book).to.have.property('permission');
        expect(book).to.have.property('visibility');

        // Verify groups structure (now inside book object)
        const groups = book.groups;
        expect(groups).to.be.an('array');

        // Verify hierarchical structure exists
        expect(groups.length).to.be.greaterThan(0);

        // Find Assets root group
        const assetsGroup = groups.find((g: any) => g.name === 'Assets');
        expect(assetsGroup).to.exist;
        expect(assetsGroup.id).to.equal('group-assets');
        expect(assetsGroup.type).to.equal('INCOMING');
        expect(assetsGroup.permanent).to.equal(true);
        expect(assetsGroup.children).to.be.an('array');
        expect(assetsGroup.children.length).to.be.greaterThan(0);

        // Verify nested structure (Current Assets under Assets)
        const currentAssets = assetsGroup.children.find((g: any) => g.name === 'Current Assets');
        expect(currentAssets).to.exist;
        expect(currentAssets.children).to.be.an('array');
        expect(currentAssets.children.length).to.be.greaterThan(0);

        // Verify deep nesting (Cash under Current Assets)
        const cashGroup = currentAssets.children.find((g: any) => g.name === 'Cash');
        expect(cashGroup).to.exist;
        expect(cashGroup.properties).to.deep.equal({ category: 'liquid' });
    });

    it('should handle MCP error for missing bookId parameter', async function () {
        try {
            await server.testCallTool('get_book', {});
            expect.fail('Should have thrown an error for missing bookId');
        } catch (error) {
            expect(error).to.be.an('error');
            // Should be a validation error about missing bookId
        }
    });

    it('should handle MCP error for non-existent book ID', async function () {
        try {
            await server.testCallTool('get_book', { bookId: 'non-existent-book' });
            expect.fail('Should have thrown an error for non-existent book');
        } catch (error) {
            expect(error).to.be.an('error');
            expect((error as Error).message).to.include('Book not found');
        }
    });

    it('should handle different book configurations via MCP', async function () {
        const response1 = await server.testCallTool('get_book', { bookId: 'book-1' });
        const response2 = await server.testCallTool('get_book', { bookId: 'book-2' });

        const jsonResponse1 = JSON.parse(response1.content[0].text as string);
        const jsonResponse2 = JSON.parse(response2.content[0].text as string);

        const book1 = jsonResponse1.book;
        const book2 = jsonResponse2.book;

        expect(book1.name).to.equal('Test Company Ltd');
        expect(book2.name).to.equal('Personal Finance');
        expect(book1.timeZone).to.equal('America/New_York');
        expect(book2.timeZone).to.equal('America/Los_Angeles');

        // Verify both books have groups (now inside book objects)
        expect(book1.groups).to.be.an('array');
        expect(book2.groups).to.be.an('array');

        // Verify book 1 has business-focused groups
        const book1Assets = book1.groups.find((g: any) => g.name === 'Assets');
        expect(book1Assets, 'Assets group should exist in book1').to.exist;
        const book1Equipment = book1Assets.children
            .find((c: any) => c.name === 'Fixed Assets')
            ?.children.find((c: any) => c.name === 'Equipment');
        expect(book1Equipment).to.exist;
        expect(book1Equipment.properties).to.deep.equal({ depreciation: 'straight-line' });

        // Verify book 2 has personal finance groups
        const book2Assets = book2.groups.find((g: any) => g.name === 'Assets');
        expect(book2Assets).to.exist;
        const book2Checking = book2Assets.children.find((c: any) => c.name === 'Checking Accounts');
        expect(book2Checking).to.exist;
        expect(book2Checking.properties).to.deep.equal({ category: 'bank' });
    });

    it('should return groups with complete hierarchical structure', async function () {
        const response = await server.testCallTool('get_book', { bookId: 'book-1' });
        const jsonResponse = JSON.parse(response.content[0].text as string);
        const book = jsonResponse.book;

        // Verify top-level structure (groups now inside book)
        expect(book.groups).to.be.an('array');

        // Should have 5 root groups (Assets, Liabilities, Equity, Revenue, Expenses)
        expect(book.groups).to.have.length(5);

        // Verify each group has required properties
        book.groups.forEach((group: any) => {
            expect(group).to.have.all.keys(
                'id',
                'name',
                'type',
                'hidden',
                'permanent',
                'properties',
                'children'
            );
            expect(group.id).to.be.a('string');
            expect(group.name).to.be.a('string');
            expect(group.type).to.be.a('string');
            expect(group.hidden).to.be.a('boolean');
            expect(group.permanent).to.be.a('boolean');
            expect(group.properties).to.be.an('object');
            expect(group.children).to.be.an('array');
        });

        // Verify nested groups also have correct structure
        const assetsGroup = book.groups.find((g: any) => g.name === 'Assets');
        expect(assetsGroup, 'Assets group should exist').to.exist;
        if (assetsGroup) {
            expect(assetsGroup.children).to.have.length(2); // Current Assets and Fixed Assets
        }

        if (assetsGroup) {
            assetsGroup.children.forEach((child: any) => {
                expect(child).to.have.all.keys(
                    'id',
                    'name',
                    'type',
                    'hidden',
                    'permanent',
                    'properties',
                    'children'
                );
            });
        }
    });

    it('should return empty groups array when book has no groups', async function () {
        // Create a mock book with no groups
        const emptyGroupsBook = [
            {
                ...mockBooks[0],
                groups: [],
            },
        ];

        const mockBkper = createMockBkperForBookWithGroups(emptyGroupsBook);
        setMockBkper(mockBkper);
        server = new BkperMcpServer();

        const response = await server.testCallTool('get_book', { bookId: 'book-1' });
        const jsonResponse = JSON.parse(response.content[0].text as string);
        const book = jsonResponse.book;

        expect(book.groups).to.be.an('array');
        expect(book.groups).to.have.length(0);
    });
});
