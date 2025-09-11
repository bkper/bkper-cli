import { expect, setupTestEnvironment, getTestPaths } from '../helpers/test-setup.js';
import { BkperMcpServerType, TransactionData, BookData } from '../helpers/mock-interfaces.js';
import { setupMocks, createMockBkperForBook, setMockBkper } from '../helpers/mock-factory.js';
import { loadTransactions, loadBooks } from '../helpers/fixture-loader.js';

const { __dirname } = getTestPaths(import.meta.url);

// Load test data
const mockBooks: BookData[] = loadBooks(__dirname);
const mockTransactions: TransactionData[] = loadTransactions(__dirname);

let currentMockTransactions: TransactionData[] = mockTransactions;

// Setup mocks and import server
setupMocks();

const { BkperMcpServer } = await import('../../../src/mcp/server.js');

describe('MCP Server - list_transactions Tool Registration', function() {
  let server: BkperMcpServerType;

  beforeEach(function() {
    setupTestEnvironment();
    currentMockTransactions = mockTransactions;
    // Create mock with books + transactions support
    const mockBkper = createMockBkperForBook(mockBooks, undefined, currentMockTransactions);
    setMockBkper(mockBkper);
    server = new BkperMcpServer();
  });

  it('should register list_transactions tool in MCP tools list', async function() {
    const response = await server.testListTools();
    
    const listTransactionsTool = response.tools.find((tool: any) => tool.name === 'list_transactions');
    
    // This test will FAIL until list_transactions tool is implemented
    expect(listTransactionsTool).to.exist;
    expect(listTransactionsTool!.name).to.equal('list_transactions');
    expect(listTransactionsTool!.description).to.include('cursor-based pagination');
    expect(listTransactionsTool!.description).to.include('query filtering');
    expect(listTransactionsTool!.inputSchema).to.have.property('properties');
    expect(listTransactionsTool!.inputSchema.properties).to.have.property('bookId');
    expect(listTransactionsTool!.inputSchema.properties).to.have.property('query');
    expect(listTransactionsTool!.inputSchema.properties).to.have.property('limit');
    expect(listTransactionsTool!.inputSchema.properties).to.have.property('cursor');
    expect(listTransactionsTool!.inputSchema.required).to.include('bookId');
    expect(listTransactionsTool!.inputSchema.required).to.include('query');
  });

  it('should handle MCP error for missing query parameter', async function() {
    try {
      await server.testCallTool('list_transactions', { bookId: 'book-1' });
      expect.fail('Should have thrown an error for missing query');
    } catch (error) {
      expect(error).to.be.an('error');
    }
  });

  it('should handle MCP list_transactions tool call', async function() {
    const response = await server.testCallTool('list_transactions', { 
      bookId: 'book-1',
      query: "account:'Cash'",
      limit: 25
    });
    
    // Verify MCP response structure
    expect(response).to.have.property('content');
    expect(response.content).to.be.an('array');
    expect(response.content).to.have.length(1);
    expect(response.content[0]).to.have.property('type', 'text');
    expect(response.content[0]).to.have.property('text');
    
    // Parse the JSON response  
    const jsonResponse = JSON.parse(response.content[0].text as string);
    expect(jsonResponse).to.have.property('transactions');
    expect(jsonResponse).to.have.property('hasMore');
    expect(jsonResponse).to.have.property('cursor');
    
    // Verify transaction structure
    if (jsonResponse.transactions.length > 0) {
      const transaction = jsonResponse.transactions[0];
      expect(transaction).to.have.property('id');
      expect(transaction).to.have.property('date');
      expect(transaction).to.have.property('amount');
      expect(transaction).to.have.property('description');
      expect(transaction).to.have.property('posted');
      expect(transaction).to.have.property('creditAccount');
      expect(transaction).to.have.property('debitAccount');
      expect(transaction).to.have.property('properties');
    }
  });

  it('should remove internal/irrelevant fields from transactions', async function() {
    const response = await server.testCallTool('list_transactions', { 
      bookId: 'book-1',
      query: "account:'Cash'",
      limit: 25
    });
    
    const jsonResponse = JSON.parse(response.content[0].text as string);
    
    if (jsonResponse.transactions.length > 0) {
      const transaction = jsonResponse.transactions[0];
      
      // Verify internal fields are removed
      expect(transaction).to.not.have.property('agentId');
      expect(transaction).to.not.have.property('agentName');
      expect(transaction).to.not.have.property('agentLogo');
      expect(transaction).to.not.have.property('agentLogoDark');
      expect(transaction).to.not.have.property('createdAt');
      expect(transaction).to.not.have.property('createdBy');
      expect(transaction).to.not.have.property('updatedAt');
      expect(transaction).to.not.have.property('dateValue');
      
      // Verify essential fields are preserved
      expect(transaction).to.have.property('id');
      expect(transaction).to.have.property('date');
      expect(transaction).to.have.property('amount');
      expect(transaction).to.have.property('description');
    }
  });

  it('should handle transactions with missing optional fields', async function() {
    // Mock a transaction with only essential fields
    const minimalTransaction = {
      id: 'tx-minimal',
      date: '2024-01-01',
      amount: '100.00',
      description: 'Minimal transaction',
      creditAccount: { id: 'acc-1', name: 'Account 1' },
      debitAccount: { id: 'acc-2', name: 'Account 2' },
      posted: true,
      checked: false
    };
    
    // Update mock to return minimal transaction
    currentMockTransactions = [minimalTransaction as TransactionData];
    const mockBkper = createMockBkperForBook(mockBooks, undefined, currentMockTransactions);
    setMockBkper(mockBkper);
    
    const response = await server.testCallTool('list_transactions', { 
      bookId: 'book-1',
      query: "any",
      limit: 25
    });
    
    const jsonResponse = JSON.parse(response.content[0].text as string);
    
    if (jsonResponse.transactions.length > 0) {
      const transaction = jsonResponse.transactions[0];
      
      // Should not have internal fields even if they weren't in original
      expect(transaction).to.not.have.property('agentId');
      expect(transaction).to.not.have.property('createdAt');
      expect(transaction).to.not.have.property('dateValue');
      
      // Should have essential fields
      expect(transaction).to.have.property('id', 'tx-minimal');
      expect(transaction).to.have.property('amount', '100.00');
    }
  });
});

// Additional MCP-focused tests can be added here following the same pattern
// The old business logic tests have been removed in favor of MCP protocol testing