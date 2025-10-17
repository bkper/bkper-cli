import { expect, setupTestEnvironment, getTestPaths } from '../helpers/test-setup.js';
import { BkperMcpServerType, BookData } from '../helpers/mock-interfaces.js';
import { setupMocks, createMockBkperForBook, setMockBkper } from '../helpers/mock-factory.js';
import { loadBooks, loadTransactionTexts } from '../helpers/fixture-loader.js';

const { __dirname } = getTestPaths(import.meta.url);

const mockBooks: BookData[] = loadBooks(__dirname);
const transactionTextsData = loadTransactionTexts(__dirname);
const validTexts = transactionTextsData.validTexts;
const createdTransactions = transactionTextsData.createdTransactions;

setupMocks();

const { BkperMcpServer } = await import('../../../src/mcp/server.js');

describe('MCP Server - record_transactions Tool Registration', function() {
  let server: BkperMcpServerType;

  beforeEach(function() {
    setupTestEnvironment();
    const mockBkper = createMockBkperForBook(mockBooks, undefined, createdTransactions);
    setMockBkper(mockBkper);
    server = new BkperMcpServer();
  });

  it('should register record_transactions tool in MCP tools list', async function() {
    const response = await server.testListTools();
    
    expect(response).to.have.property('tools');
    expect(response.tools).to.be.an('array');
    
    const recordTransactionsTool = response.tools.find((tool: any) => tool.name === 'record_transactions');
    expect(recordTransactionsTool).to.exist;
    expect(recordTransactionsTool!.name).to.equal('record_transactions');
  });

  it('should have description mentioning batch creation from text', async function() {
    const response = await server.testListTools();
    const recordTransactionsTool = response.tools.find((tool: any) => tool.name === 'record_transactions');
    
    expect(recordTransactionsTool).to.exist;
    if (recordTransactionsTool) {
      expect(recordTransactionsTool.description).to.include('natural language');
    }
  });

  it('should have proper MCP tool schema for record_transactions', async function() {
    const response = await server.testListTools();
    const recordTransactionsTool = response.tools.find((tool: any) => tool.name === 'record_transactions') as any;
    
    expect(recordTransactionsTool).to.exist;
    expect(recordTransactionsTool.inputSchema).to.have.property('properties');
    expect(recordTransactionsTool.inputSchema.properties).to.have.property('bookId');
    expect(recordTransactionsTool.inputSchema.properties).to.have.property('transaction_texts');
    expect(recordTransactionsTool.inputSchema.properties.bookId.type).to.equal('string');
    expect(recordTransactionsTool.inputSchema.properties.transaction_texts.type).to.equal('array');
  });

  it('should have bookId and transaction_texts as required parameters', async function() {
    const response = await server.testListTools();
    const recordTransactionsTool = response.tools.find((tool: any) => tool.name === 'record_transactions') as any;
    
    expect(recordTransactionsTool.inputSchema.required).to.be.an('array');
    expect(recordTransactionsTool.inputSchema.required).to.include('bookId');
    expect(recordTransactionsTool.inputSchema.required).to.include('transaction_texts');
  });

  it('should not have dry_run parameter', async function() {
    const response = await server.testListTools();
    const recordTransactionsTool = response.tools.find((tool: any) => tool.name === 'record_transactions') as any;
    
    expect(recordTransactionsTool.inputSchema.properties).to.not.have.property('dry_run');
  });
});

describe('MCP Server - record_transactions Basic Functionality', function() {
  let server: BkperMcpServerType;

  beforeEach(function() {
    setupTestEnvironment();
    const mockBkper = createMockBkperForBook(mockBooks, undefined, createdTransactions);
    setMockBkper(mockBkper);
    server = new BkperMcpServer();
  });

  it('should successfully record transactions from valid text array', async function() {
    const response = await server.testCallTool('record_transactions', {
      bookId: 'book-1',
      transaction_texts: validTexts
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

  it('should return created transactions with IDs', async function() {
    const response = await server.testCallTool('record_transactions', {
      bookId: 'book-1',
      transaction_texts: validTexts
    });
    
    const jsonResponse = JSON.parse(response.content[0].text as string);
    
    expect(jsonResponse.transactions).to.have.length(validTexts.length);
    jsonResponse.transactions.forEach((tx: any) => {
      expect(tx).to.have.property('id');
      expect(tx.id).to.be.a('string');
      expect(tx.id).to.not.be.empty;
    });
  });

  it('should return MCP-compliant response structure', async function() {
    const response = await server.testCallTool('record_transactions', {
      bookId: 'book-1',
      transaction_texts: validTexts
    });
    
    expect(response.content[0].type).to.equal('text');
    const jsonResponse = JSON.parse(response.content[0].text as string);
    expect(jsonResponse).to.be.an('object');
    expect(jsonResponse.transactions).to.be.an('array');
  });
});

describe('MCP Server - record_transactions Batch Processing', function() {
  let server: BkperMcpServerType;

  beforeEach(function() {
    setupTestEnvironment();
    const mockBkper = createMockBkperForBook(mockBooks, undefined, createdTransactions);
    setMockBkper(mockBkper);
    server = new BkperMcpServer();
  });

  it('should create single transaction', async function() {
    const response = await server.testCallTool('record_transactions', {
      bookId: 'book-1',
      transaction_texts: [validTexts[0]]
    });
    
    const jsonResponse = JSON.parse(response.content[0].text as string);
    expect(jsonResponse.transactions).to.have.length(1);
  });

  it('should create multiple transactions in one call', async function() {
    const response = await server.testCallTool('record_transactions', {
      bookId: 'book-1',
      transaction_texts: validTexts
    });
    
    const jsonResponse = JSON.parse(response.content[0].text as string);
    expect(jsonResponse.transactions).to.have.length(validTexts.length);
  });

  it('should return all created transactions', async function() {
    const response = await server.testCallTool('record_transactions', {
      bookId: 'book-1',
      transaction_texts: validTexts
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

  it('should handle empty array', async function() {
    const response = await server.testCallTool('record_transactions', {
      bookId: 'book-1',
      transaction_texts: []
    });
    
    const jsonResponse = JSON.parse(response.content[0].text as string);
    expect(jsonResponse.transactions).to.be.an('array');
    expect(jsonResponse.transactions).to.have.length(0);
  });
});

describe('MCP Server - record_transactions Parameter Validation', function() {
  let server: BkperMcpServerType;

  beforeEach(function() {
    setupTestEnvironment();
    const mockBkper = createMockBkperForBook(mockBooks, undefined, createdTransactions);
    setMockBkper(mockBkper);
    server = new BkperMcpServer();
  });

  it('should throw McpError for missing bookId', async function() {
    try {
      await server.testCallTool('record_transactions', {
        transaction_texts: validTexts
      });
      expect.fail('Should have thrown an error for missing bookId');
    } catch (error) {
      expect(error).to.be.an('error');
      expect((error as Error).message).to.include('bookId');
    }
  });

  it('should throw McpError for missing transaction_texts', async function() {
    try {
      await server.testCallTool('record_transactions', {
        bookId: 'book-1'
      });
      expect.fail('Should have thrown an error for missing transaction_texts');
    } catch (error) {
      expect(error).to.be.an('error');
      expect((error as Error).message).to.include('transaction_texts');
    }
  });

  it('should throw McpError for non-array transaction_texts', async function() {
    try {
      await server.testCallTool('record_transactions', {
        bookId: 'book-1',
        transaction_texts: 'not an array'
      });
      expect.fail('Should have thrown an error for non-array transaction_texts');
    } catch (error) {
      expect(error).to.be.an('error');
      expect((error as Error).message).to.include('transaction_texts');
    }
  });

  it('should throw McpError for invalid book ID', async function() {
    const mockBkper = {
      setConfig: () => {},
      getBook: async (id: string) => {
        if (id === 'invalid-book-id') {
          throw new Error('Book not found: invalid-book-id');
        }
        return createMockBkperForBook(mockBooks, undefined, createdTransactions).getBook!(id);
      }
    };
    setMockBkper(mockBkper);
    server = new BkperMcpServer();

    try {
      await server.testCallTool('record_transactions', {
        bookId: 'invalid-book-id',
        transaction_texts: validTexts
      });
      expect.fail('Should have thrown an error for invalid book ID');
    } catch (error) {
      expect(error).to.be.an('error');
      expect((error as Error).message).to.include('Book not found');
    }
  });
});

describe('MCP Server - record_transactions Response Format', function() {
  let server: BkperMcpServerType;

  beforeEach(function() {
    setupTestEnvironment();
    const mockBkper = createMockBkperForBook(mockBooks, undefined, createdTransactions);
    setMockBkper(mockBkper);
    server = new BkperMcpServer();
  });

  it('should have transactions array in response', async function() {
    const response = await server.testCallTool('record_transactions', {
      bookId: 'book-1',
      transaction_texts: validTexts
    });
    
    const jsonResponse = JSON.parse(response.content[0].text as string);
    expect(jsonResponse).to.have.property('transactions');
    expect(jsonResponse.transactions).to.be.an('array');
  });

  it('should include standard transaction fields', async function() {
    const response = await server.testCallTool('record_transactions', {
      bookId: 'book-1',
      transaction_texts: validTexts
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

  it('should remove internal fields from transactions', async function() {
    const response = await server.testCallTool('record_transactions', {
      bookId: 'book-1',
      transaction_texts: validTexts
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

  it('should return valid JSON in MCP text content format', async function() {
    const response = await server.testCallTool('record_transactions', {
      bookId: 'book-1',
      transaction_texts: validTexts
    });
    
    expect(() => JSON.parse(response.content[0].text as string)).to.not.throw();
  });

  it('should preserve transaction account information', async function() {
    const response = await server.testCallTool('record_transactions', {
      bookId: 'book-1',
      transaction_texts: validTexts
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
