import { expect, setupTestEnvironment, getTestPaths } from '../helpers/test-setup.js';
import { BkperMcpServerType, BookData } from '../helpers/mock-interfaces.js';
import { setupMocks, createMockBkperForBook, setMockBkper } from '../helpers/mock-factory.js';
import { loadBooks, loadTransactionTexts } from '../helpers/fixture-loader.js';

const { __dirname } = getTestPaths(import.meta.url);

const mockBooks: BookData[] = loadBooks(__dirname);
const transactionTextsData = loadTransactionTexts(__dirname);
const validTransactions = transactionTextsData.validTransactions;
const createdTransactions = transactionTextsData.createdTransactions;

setupMocks();

const { BkperMcpServer } = await import('../../../src/mcp/server.js');

describe('MCP Server - create_transactions Tool Registration', function () {
    let server: BkperMcpServerType;

    beforeEach(function () {
        setupTestEnvironment();
        const mockBkper = createMockBkperForBook(mockBooks, undefined, createdTransactions);
        setMockBkper(mockBkper);
        server = new BkperMcpServer();
    });

    it('should register create_transactions tool in MCP tools list', async function () {
        const response = await server.testListTools();

        expect(response).to.have.property('tools');
        expect(response.tools).to.be.an('array');

        const createTransactionsTool = response.tools.find(
            (tool: any) => tool.name === 'create_transactions'
        );
        expect(createTransactionsTool).to.exist;
        expect(createTransactionsTool!.name).to.equal('create_transactions');
    });

    it('should have description mentioning structured data', async function () {
        const response = await server.testListTools();
        const createTransactionsTool = response.tools.find(
            (tool: any) => tool.name === 'create_transactions'
        );

        expect(createTransactionsTool).to.exist;
        if (createTransactionsTool) {
            expect(createTransactionsTool.description).to.include('structured');
        }
    });

    it('should have proper MCP tool schema for create_transactions', async function () {
        const response = await server.testListTools();
        const createTransactionsTool = response.tools.find(
            (tool: any) => tool.name === 'create_transactions'
        ) as any;

        expect(createTransactionsTool).to.exist;
        expect(createTransactionsTool.inputSchema).to.have.property('properties');
        expect(createTransactionsTool.inputSchema.properties).to.have.property('bookId');
        expect(createTransactionsTool.inputSchema.properties).to.have.property('transactions');
        expect(createTransactionsTool.inputSchema.properties.bookId.type).to.equal('string');
        expect(createTransactionsTool.inputSchema.properties.transactions.type).to.equal('array');
    });

    it('should have bookId and transactions as required parameters', async function () {
        const response = await server.testListTools();
        const createTransactionsTool = response.tools.find(
            (tool: any) => tool.name === 'create_transactions'
        ) as any;

        expect(createTransactionsTool.inputSchema.required).to.be.an('array');
        expect(createTransactionsTool.inputSchema.required).to.include('bookId');
        expect(createTransactionsTool.inputSchema.required).to.include('transactions');
    });

    it('should have transaction schema with required and optional fields', async function () {
        const response = await server.testListTools();
        const createTransactionsTool = response.tools.find(
            (tool: any) => tool.name === 'create_transactions'
        ) as any;

        expect(createTransactionsTool.inputSchema.properties.transactions.items).to.exist;
        expect(createTransactionsTool.inputSchema.properties.transactions.items.type).to.equal(
            'object'
        );
        expect(
            createTransactionsTool.inputSchema.properties.transactions.items.properties
        ).to.have.property('date');
        expect(
            createTransactionsTool.inputSchema.properties.transactions.items.properties
        ).to.have.property('amount');
        expect(
            createTransactionsTool.inputSchema.properties.transactions.items.properties
        ).to.have.property('from_account');
        expect(
            createTransactionsTool.inputSchema.properties.transactions.items.properties
        ).to.have.property('to_account');
        expect(
            createTransactionsTool.inputSchema.properties.transactions.items.properties
        ).to.have.property('description');

        // Verify only date, amount, and description are required
        expect(createTransactionsTool.inputSchema.properties.transactions.items.required).to.be.an(
            'array'
        );
        expect(
            createTransactionsTool.inputSchema.properties.transactions.items.required
        ).to.include('date');
        expect(
            createTransactionsTool.inputSchema.properties.transactions.items.required
        ).to.include('amount');
        expect(
            createTransactionsTool.inputSchema.properties.transactions.items.required
        ).to.include('description');
        expect(
            createTransactionsTool.inputSchema.properties.transactions.items.required
        ).to.not.include('from_account');
        expect(
            createTransactionsTool.inputSchema.properties.transactions.items.required
        ).to.not.include('to_account');
    });
});

describe('MCP Server - create_transactions Basic Functionality', function () {
    let server: BkperMcpServerType;

    beforeEach(function () {
        setupTestEnvironment();
        const mockBkper = createMockBkperForBook(mockBooks, undefined, createdTransactions);
        setMockBkper(mockBkper);
        server = new BkperMcpServer();
    });

    it('should successfully create transactions from structured data', async function () {
        const response = await server.testCallTool('create_transactions', {
            bookId: 'book-1',
            transactions: validTransactions,
        });

        expect(response).to.have.property('content');
        expect(response.content).to.be.an('array');
        expect(response.content).to.have.length(1);
        expect(response.content[0]).to.have.property('type', 'text');
        expect(response.content[0]).to.have.property('text');

        const jsonResponse = JSON.parse(response.content[0].text as string);
        expect(jsonResponse).to.have.property('transactions');
        expect(jsonResponse.transactions).to.be.an('array');
    });

    it('should return created transactions with IDs', async function () {
        const response = await server.testCallTool('create_transactions', {
            bookId: 'book-1',
            transactions: validTransactions,
        });

        const jsonResponse = JSON.parse(response.content[0].text as string);

        expect(jsonResponse.transactions).to.have.length(validTransactions.length);
        jsonResponse.transactions.forEach((tx: any) => {
            expect(tx).to.have.property('id');
            expect(tx.id).to.be.a('string');
            expect(tx.id).to.not.be.empty;
        });
    });

    it('should return MCP-compliant response structure', async function () {
        const response = await server.testCallTool('create_transactions', {
            bookId: 'book-1',
            transactions: validTransactions,
        });

        expect(response.content[0].type).to.equal('text');
        const jsonResponse = JSON.parse(response.content[0].text as string);
        expect(jsonResponse).to.be.an('object');
        expect(jsonResponse.transactions).to.be.an('array');
    });
});

describe('MCP Server - create_transactions Batch Processing', function () {
    let server: BkperMcpServerType;

    beforeEach(function () {
        setupTestEnvironment();
        const mockBkper = createMockBkperForBook(mockBooks, undefined, createdTransactions);
        setMockBkper(mockBkper);
        server = new BkperMcpServer();
    });

    it('should create single transaction', async function () {
        const response = await server.testCallTool('create_transactions', {
            bookId: 'book-1',
            transactions: [validTransactions[0]],
        });

        const jsonResponse = JSON.parse(response.content[0].text as string);
        expect(jsonResponse.transactions).to.have.length(1);
    });

    it('should create multiple transactions in one call', async function () {
        const response = await server.testCallTool('create_transactions', {
            bookId: 'book-1',
            transactions: validTransactions,
        });

        const jsonResponse = JSON.parse(response.content[0].text as string);
        expect(jsonResponse.transactions).to.have.length(validTransactions.length);
    });

    it('should return all created transactions', async function () {
        const response = await server.testCallTool('create_transactions', {
            bookId: 'book-1',
            transactions: validTransactions,
        });

        const jsonResponse = JSON.parse(response.content[0].text as string);
        expect(jsonResponse.transactions).to.be.an('array');
        jsonResponse.transactions.forEach((tx: any) => {
            expect(tx).to.have.property('id');
            expect(tx).to.have.property('date');
            expect(tx).to.have.property('amount');
            expect(tx).to.have.property('description');
        });
    });

    it('should handle empty array', async function () {
        const response = await server.testCallTool('create_transactions', {
            bookId: 'book-1',
            transactions: [],
        });

        const jsonResponse = JSON.parse(response.content[0].text as string);
        expect(jsonResponse.transactions).to.be.an('array');
        expect(jsonResponse.transactions).to.have.length(0);
    });
});

describe('MCP Server - create_transactions Parameter Validation', function () {
    let server: BkperMcpServerType;

    beforeEach(function () {
        setupTestEnvironment();
        const mockBkper = createMockBkperForBook(mockBooks, undefined, createdTransactions);
        setMockBkper(mockBkper);
        server = new BkperMcpServer();
    });

    it('should throw McpError for missing bookId', async function () {
        try {
            await server.testCallTool('create_transactions', {
                transactions: validTransactions,
            });
            expect.fail('Should have thrown an error for missing bookId');
        } catch (error) {
            expect(error).to.be.an('error');
            expect((error as Error).message).to.include('bookId');
        }
    });

    it('should throw McpError for missing transactions', async function () {
        try {
            await server.testCallTool('create_transactions', {
                bookId: 'book-1',
            });
            expect.fail('Should have thrown an error for missing transactions');
        } catch (error) {
            expect(error).to.be.an('error');
            expect((error as Error).message).to.include('transactions');
        }
    });

    it('should throw McpError for non-array transactions', async function () {
        try {
            await server.testCallTool('create_transactions', {
                bookId: 'book-1',
                transactions: 'not an array',
            });
            expect.fail('Should have thrown an error for non-array transactions');
        } catch (error) {
            expect(error).to.be.an('error');
            expect((error as Error).message).to.include('transactions');
        }
    });

    it('should throw McpError for invalid book ID', async function () {
        const mockBkper = {
            setConfig: () => {},
            getBook: async (id: string) => {
                if (id === 'invalid-book-id') {
                    throw new Error('Book not found: invalid-book-id');
                }
                return createMockBkperForBook(mockBooks, undefined, createdTransactions).getBook!(
                    id
                );
            },
        };
        setMockBkper(mockBkper);
        server = new BkperMcpServer();

        try {
            await server.testCallTool('create_transactions', {
                bookId: 'invalid-book-id',
                transactions: validTransactions,
            });
            expect.fail('Should have thrown an error for invalid book ID');
        } catch (error) {
            expect(error).to.be.an('error');
            expect((error as Error).message).to.include('Book not found');
        }
    });

    it('should throw McpError for missing date field', async function () {
        try {
            await server.testCallTool('create_transactions', {
                bookId: 'book-1',
                transactions: [
                    {
                        amount: 500,
                        from_account: 'Cash',
                        to_account: 'Rent',
                        description: 'test',
                    },
                ],
            });
            expect.fail('Should have thrown an error for missing date');
        } catch (error) {
            expect(error).to.be.an('error');
            expect((error as Error).message).to.include('date');
        }
    });

    it('should throw McpError for missing amount field', async function () {
        try {
            await server.testCallTool('create_transactions', {
                bookId: 'book-1',
                transactions: [
                    {
                        date: '2025-01-15',
                        from_account: 'Cash',
                        to_account: 'Rent',
                        description: 'test',
                    },
                ],
            });
            expect.fail('Should have thrown an error for missing amount');
        } catch (error) {
            expect(error).to.be.an('error');
            expect((error as Error).message).to.include('amount');
        }
    });

    it('should accept transaction with missing from_account field', async function () {
        const response = await server.testCallTool('create_transactions', {
            bookId: 'book-1',
            transactions: [
                {
                    date: '2025-01-15',
                    amount: 500,
                    to_account: 'Rent',
                    description: 'test',
                },
            ],
        });

        expect(response).to.have.property('content');
        const jsonResponse = JSON.parse(response.content[0].text as string);
        expect(jsonResponse.transactions).to.have.length(1);
    });

    it('should accept transaction with missing to_account field', async function () {
        const response = await server.testCallTool('create_transactions', {
            bookId: 'book-1',
            transactions: [
                {
                    date: '2025-01-15',
                    amount: 500,
                    from_account: 'Cash',
                    description: 'test',
                },
            ],
        });

        expect(response).to.have.property('content');
        const jsonResponse = JSON.parse(response.content[0].text as string);
        expect(jsonResponse.transactions).to.have.length(1);
    });

    it('should throw McpError for missing description field', async function () {
        try {
            await server.testCallTool('create_transactions', {
                bookId: 'book-1',
                transactions: [
                    {
                        date: '2025-01-15',
                        amount: 500,
                        from_account: 'Cash',
                        to_account: 'Rent',
                    },
                ],
            });
            expect.fail('Should have thrown an error for missing description');
        } catch (error) {
            expect(error).to.be.an('error');
            expect((error as Error).message).to.include('description');
        }
    });

    it('should accept empty string from_account when provided', async function () {
        const response = await server.testCallTool('create_transactions', {
            bookId: 'book-1',
            transactions: [
                {
                    date: '2025-01-15',
                    amount: 500,
                    from_account: '',
                    to_account: 'Rent',
                    description: 'test',
                },
            ],
        });

        expect(response).to.have.property('content');
        const jsonResponse = JSON.parse(response.content[0].text as string);
        expect(jsonResponse.transactions).to.have.length(1);
    });

    it('should accept empty string to_account when provided', async function () {
        const response = await server.testCallTool('create_transactions', {
            bookId: 'book-1',
            transactions: [
                {
                    date: '2025-01-15',
                    amount: 500,
                    from_account: 'Cash',
                    to_account: '',
                    description: 'test',
                },
            ],
        });

        expect(response).to.have.property('content');
        const jsonResponse = JSON.parse(response.content[0].text as string);
        expect(jsonResponse.transactions).to.have.length(1);
    });

    it('should throw McpError for empty string description', async function () {
        try {
            await server.testCallTool('create_transactions', {
                bookId: 'book-1',
                transactions: [
                    {
                        date: '2025-01-15',
                        amount: 500,
                        from_account: 'Cash',
                        to_account: 'Rent',
                        description: '',
                    },
                ],
            });
            expect.fail('Should have thrown an error for empty description');
        } catch (error) {
            expect(error).to.be.an('error');
            expect((error as Error).message).to.include('description');
        }
    });
});

describe('MCP Server - create_transactions Optional Account Fields', function () {
    let server: BkperMcpServerType;

    beforeEach(function () {
        setupTestEnvironment();
        const mockBkper = createMockBkperForBook(mockBooks, undefined, createdTransactions);
        setMockBkper(mockBkper);
        server = new BkperMcpServer();
    });

    it('should create transaction with only description (no accounts)', async function () {
        const response = await server.testCallTool('create_transactions', {
            bookId: 'book-1',
            transactions: [
                {
                    date: '2025-01-15',
                    amount: 500,
                    description: 'Payment received',
                },
            ],
        });

        const jsonResponse = JSON.parse(response.content[0].text as string);
        expect(jsonResponse.transactions).to.have.length(1);
        expect(jsonResponse.transactions[0]).to.have.property('description', 'Payment received');
    });

    it('should create transaction with only from_account', async function () {
        const response = await server.testCallTool('create_transactions', {
            bookId: 'book-1',
            transactions: [
                {
                    date: '2025-01-15',
                    amount: 500,
                    from_account: 'Cash',
                    description: 'Withdrawal',
                },
            ],
        });

        const jsonResponse = JSON.parse(response.content[0].text as string);
        expect(jsonResponse.transactions).to.have.length(1);
        expect(jsonResponse.transactions[0]).to.have.property('description', 'Cash Withdrawal');
    });

    it('should create transaction with only to_account', async function () {
        const response = await server.testCallTool('create_transactions', {
            bookId: 'book-1',
            transactions: [
                {
                    date: '2025-01-15',
                    amount: 500,
                    to_account: 'Revenue',
                    description: 'Sale',
                },
            ],
        });

        const jsonResponse = JSON.parse(response.content[0].text as string);
        expect(jsonResponse.transactions).to.have.length(1);
        expect(jsonResponse.transactions[0]).to.have.property('description', 'Revenue Sale');
    });

    it('should create transaction with both accounts', async function () {
        const response = await server.testCallTool('create_transactions', {
            bookId: 'book-1',
            transactions: [
                {
                    date: '2025-01-15',
                    amount: 500,
                    from_account: 'Cash',
                    to_account: 'Rent',
                    description: 'Monthly rent',
                },
            ],
        });

        const jsonResponse = JSON.parse(response.content[0].text as string);
        expect(jsonResponse.transactions).to.have.length(1);
        expect(jsonResponse.transactions[0]).to.have.property(
            'description',
            'Cash Rent Monthly rent'
        );
    });
});

describe('MCP Server - create_transactions Response Format', function () {
    let server: BkperMcpServerType;

    beforeEach(function () {
        setupTestEnvironment();
        const mockBkper = createMockBkperForBook(mockBooks, undefined, createdTransactions);
        setMockBkper(mockBkper);
        server = new BkperMcpServer();
    });

    it('should have transactions array in response', async function () {
        const response = await server.testCallTool('create_transactions', {
            bookId: 'book-1',
            transactions: validTransactions,
        });

        const jsonResponse = JSON.parse(response.content[0].text as string);
        expect(jsonResponse).to.have.property('transactions');
        expect(jsonResponse.transactions).to.be.an('array');
    });

    it('should include standard transaction fields', async function () {
        const response = await server.testCallTool('create_transactions', {
            bookId: 'book-1',
            transactions: validTransactions,
        });

        const jsonResponse = JSON.parse(response.content[0].text as string);
        const transaction = jsonResponse.transactions[0];

        expect(transaction).to.have.property('id');
        expect(transaction).to.have.property('date');
        expect(transaction).to.have.property('amount');
        expect(transaction).to.have.property('description');
        expect(transaction).to.have.property('posted');
        expect(transaction).to.have.property('checked');
    });

    it('should remove internal fields from transactions', async function () {
        const response = await server.testCallTool('create_transactions', {
            bookId: 'book-1',
            transactions: validTransactions,
        });

        const jsonResponse = JSON.parse(response.content[0].text as string);
        const transaction = jsonResponse.transactions[0];

        expect(transaction).to.not.have.property('agentId');
        expect(transaction).to.not.have.property('agentName');
        expect(transaction).to.not.have.property('agentLogo');
        expect(transaction).to.not.have.property('agentLogoDark');
        expect(transaction).to.not.have.property('createdAt');
        expect(transaction).to.not.have.property('createdBy');
        expect(transaction).to.not.have.property('updatedAt');
        expect(transaction).to.not.have.property('dateValue');
    });

    it('should return valid JSON in MCP text content format', async function () {
        const response = await server.testCallTool('create_transactions', {
            bookId: 'book-1',
            transactions: validTransactions,
        });

        expect(() => JSON.parse(response.content[0].text as string)).to.not.throw();
    });

    it('should preserve transaction account information', async function () {
        const response = await server.testCallTool('create_transactions', {
            bookId: 'book-1',
            transactions: validTransactions,
        });

        const jsonResponse = JSON.parse(response.content[0].text as string);
        const transaction = jsonResponse.transactions[0];

        if (transaction.creditAccount) {
            expect(transaction.creditAccount).to.have.property('name');
            expect(transaction.creditAccount).to.have.property('type');
        }

        if (transaction.debitAccount) {
            expect(transaction.debitAccount).to.have.property('name');
            expect(transaction.debitAccount).to.have.property('type');
        }
    });
});
