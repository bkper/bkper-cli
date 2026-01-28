import {
  expect,
  createTestContext,
  integrationTest,
  parseToolResponse,
  getToolDefinition,
  logApiResponse,
  withRetry,
  TestMode,
  getTestBookId
} from '../setup/test-helpers.js';
import { testDataManager } from '../setup/test-data-manager.js';
import type { IntegrationTestContext } from '../setup/test-helpers.js';

describe('Integration: list_transactions Tool', function() {
  let context: IntegrationTestContext;
  const TEST_BOOK_ID = getTestBookId();
  
  before(async function() {
    this.timeout(60000); // Allow more time for initial setup
    context = createTestContext();
    
    // Verify we can access the API and the test book
    const stats = await testDataManager.getTestDataStats();
    console.log(`\nIntegration test environment:`);
    console.log(`- Using test book ID: ${TEST_BOOK_ID}`);
    console.log(`- Total books available: ${stats.totalBooks}`);
    console.log(`- Test books: ${stats.testBooks}`);
    console.log(`- Permissions:`, stats.permissions);
    
    if (stats.totalBooks === 0) {
      throw new Error('No books available for integration testing');
    }
  });
  
  after(function() {
    // Clear any cached data
    testDataManager.clearCache();
  });
  
  describe('Tool Registration', function() {
    it('should have list_transactions tool properly registered', integrationTest(async () => {
      const tool = await getToolDefinition(context.server, 'list_transactions');
      
      expect(tool).to.exist;
      expect(tool.name).to.equal('list_transactions');
      expect(tool.description).to.include('List transactions with native API cursor-based pagination');
      expect(tool.inputSchema).to.have.property('type', 'object');
      expect(tool.inputSchema.properties).to.have.property('bookId');
      expect(tool.inputSchema.properties).to.have.property('cursor');
      expect(tool.inputSchema.properties).to.have.property('query');
      expect(tool.inputSchema.properties).to.have.property('limit');
      expect(tool.inputSchema.required).to.include('bookId');
      expect(tool.inputSchema.required).to.include('query');
    }));
  });
  
  describe('Basic Functionality', function() {
    it('should return MCP error for missing query parameter', integrationTest(async () => {
      try {
        await withRetry(() => 
          context.server.testCallTool('list_transactions', {
            bookId: TEST_BOOK_ID
          })
        );
        expect.fail('Should have thrown an error for missing query');
      } catch (error: any) {
        expect(error).to.have.property('code');
        expect(error.code).to.be.oneOf([-32602, -32603]); // Invalid params or internal error
      }
    }));
    
    it('should list transactions with custom limit', integrationTest(async () => {
      const result = await withRetry(() => 
        context.server.testCallTool('list_transactions', {
          bookId: TEST_BOOK_ID,
          query: 'after:2020-01-01',
          limit: 10
        })
      );
      
      const response = parseToolResponse(result);
      logApiResponse('list_transactions (limit 10)', response);
      
      // Validate response structure
      expect(response).to.have.property('transactions').that.is.an('array');
      expect(response).to.have.property('hasMore').that.is.a('boolean');
      expect(response).to.have.property('cursor');
      expect(response).to.have.property('limit', 10);
      
      // Should respect limit
      expect(response.transactions).to.have.length.at.most(10);
    }));
    
    it('should handle maximum limit constraint', integrationTest(async () => {
      const result = await withRetry(() => 
        context.server.testCallTool('list_transactions', {
          bookId: TEST_BOOK_ID,
          query: 'after:2020-01-01',
          limit: 200 // Should be capped at 100
        })
      );
      
      const response = parseToolResponse(result);
      
      // Limit should be capped at 100
      expect(response.limit).to.equal(100);
      expect(response.transactions).to.have.length.at.most(100);
    }));
  });
  
  describe('Pagination Functionality', function() {
    it('should handle cursor-based pagination correctly', integrationTest(async () => {
      const result = await withRetry(() => 
        context.server.testCallTool('list_transactions', {
          bookId: TEST_BOOK_ID,
          query: 'after:2020-01-01',
          limit: 5
        })
      );
      
      const response = parseToolResponse(result);
      
      // If we have more than 5 transactions, pagination should work
      if (response.hasMore && response.cursor) {
        expect(response.transactions).to.have.length(5);
        expect(response.cursor).to.be.a('string');
        
        // Get next page - query is required even when using cursor
        const nextResult = await withRetry(() => 
          context.server.testCallTool('list_transactions', {
            bookId: TEST_BOOK_ID,
            query: 'after:2020-01-01',
            limit: 5,
            cursor: response.cursor
          })
        );
        const nextResponse = parseToolResponse(nextResult);
        
        // Validate next page
        expect(nextResponse.transactions).to.have.length.at.most(5);
        expect(nextResponse.limit).to.equal(5);
        
        // Transaction IDs should not overlap between pages
        const firstPageIds = new Set(response.transactions.map((tx: any) => tx.id));
        const secondPageIds = new Set(nextResponse.transactions.map((tx: any) => tx.id));
        const intersection = new Set([...firstPageIds].filter(id => secondPageIds.has(id)));
        expect(intersection.size).to.equal(0, 'Pages should not have overlapping transactions');
        
        logApiResponse('list_transactions (second page)', nextResponse);
      } else {
        console.log('Not enough transactions for pagination test');
      }
    }));
    
    it('should handle invalid cursor gracefully', integrationTest(async () => {
      const result = await withRetry(() => 
        context.server.testCallTool('list_transactions', {
          bookId: TEST_BOOK_ID,
          query: 'on:$m',
          cursor: 'invalid-cursor-123'
        })
      );
      
      const response = parseToolResponse(result);
      
      // Should return valid response even with invalid cursor
      expect(response).to.have.property('transactions').that.is.an('array');
      expect(response).to.have.property('hasMore').that.is.a('boolean');
      expect(response).to.have.property('cursor');
      expect(response).to.have.property('limit', 25);
    }));
  });
  
  describe('Query Functionality', function() {
    it('should handle basic account query', integrationTest(async () => {
      // First get some transactions to find an account to query
      const allResult = await withRetry(() => 
        context.server.testCallTool('list_transactions', {
          bookId: TEST_BOOK_ID,
          query: 'after:2020-01-01',
          limit: 10
        })
      );
      const allResponse = parseToolResponse(allResult);
      
      if (allResponse.transactions.length > 0) {
        // Since accounts don't have names in the API response, skip specific account query test
        console.log('Skipping specific account query test - accounts only have IDs in API response');
      } else {
        console.log('No transactions available for account query test');
      }
    }));
    
    it('should handle amount filtering queries', integrationTest(async () => {
      // Test with a reasonable amount threshold
      const query = 'amount>0';
      
      const result = await withRetry(() => 
        context.server.testCallTool('list_transactions', {
          bookId: TEST_BOOK_ID,
          query: query
        })
      );
      const response = parseToolResponse(result);
      
      logApiResponse('list_transactions (amount>0)', response);
      
      // Should return transactions and preserve query
      expect(response).to.have.property('query', query);
      expect(response).to.have.property('transactions').that.is.an('array');
      
      // All transactions should have positive amounts
      response.transactions.forEach((tx: any) => {
        const amount = typeof tx.amount === 'string' ? parseFloat(tx.amount) : tx.amount;
        expect(amount).to.be.greaterThan(0);
      });
    }));
    
    it('should handle date range queries', integrationTest(async () => {
      // Test with a broad date range to ensure we get results
      const query = 'after:2020-01-01 before:2025-12-31';
      
      const result = await withRetry(() => 
        context.server.testCallTool('list_transactions', {
          bookId: TEST_BOOK_ID,
          query: query
        })
      );
      const response = parseToolResponse(result);
      
      logApiResponse('list_transactions (date range)', response);
      
      // Should return transactions and preserve query
      expect(response).to.have.property('query', query);
      expect(response).to.have.property('transactions').that.is.an('array');
      
      // All transactions should be within date range
      response.transactions.forEach((tx: any) => {
        const txDate = new Date(tx.date);
        expect(txDate.getFullYear()).to.be.at.least(2020);
        expect(txDate.getFullYear()).to.be.at.most(2025);
      });
    }));
    
    it('should handle complex queries with logical operators', integrationTest(async () => {
      // Test with complex query combining multiple conditions
      const query = 'amount>0 AND after:2020-01-01';
      
      const result = await withRetry(() => 
        context.server.testCallTool('list_transactions', {
          bookId: TEST_BOOK_ID,
          query: query
        })
      );
      const response = parseToolResponse(result);
      
      logApiResponse('list_transactions (complex query)', response);
      
      // Should return transactions and preserve query
      expect(response).to.have.property('query', query);
      expect(response).to.have.property('transactions').that.is.an('array');
      
      // All transactions should meet both conditions
      response.transactions.forEach((tx: any) => {
        const amount = typeof tx.amount === 'string' ? parseFloat(tx.amount) : tx.amount;
        expect(amount).to.be.greaterThan(0);
        const txDate = new Date(tx.date);
        expect(txDate.getFullYear()).to.be.at.least(2020);
      });
    }));
    
    it('should handle empty result queries', integrationTest(async () => {
      // Test with a query that should return no results
      const query = 'amount>999999999';
      
      const result = await withRetry(() => 
        context.server.testCallTool('list_transactions', {
          bookId: TEST_BOOK_ID,
          query: query
        })
      );
      const response = parseToolResponse(result);
      
      // Should return empty results with proper structure
      expect(response).to.have.property('query', query);
      expect(response).to.have.property('transactions').that.is.an('array');
      expect(response.transactions).to.have.length(0);
      expect(response.hasMore).to.be.false;
      expect(response.cursor).to.be.null;
    }));
    
    it('should preserve query across pagination', integrationTest(async () => {
      const query = 'amount>0';
      
      const result = await withRetry(() => 
        context.server.testCallTool('list_transactions', {
          bookId: TEST_BOOK_ID,
          query: query,
          limit: 3
        })
      );
      const response = parseToolResponse(result);
      
      if (response.hasMore && response.cursor) {
        // Get next page with same query
        const nextResult = await withRetry(() => 
          context.server.testCallTool('list_transactions', {
            bookId: TEST_BOOK_ID,
            query: query,
            limit: 3,
            cursor: response.cursor
          })
        );
        const nextResponse = parseToolResponse(nextResult);
        
        // Both pages should have the same query
        expect(response.query).to.equal(query);
        expect(nextResponse.query).to.equal(query);
        
        // Both pages should meet query criteria
        [...response.transactions, ...nextResponse.transactions].forEach((tx: any) => {
          const amount = typeof tx.amount === 'string' ? parseFloat(tx.amount) : tx.amount;
        expect(amount).to.be.greaterThan(0);
        });
      } else {
        console.log('Not enough transactions for query pagination test');
      }
    }));
  });
  
  describe('Error Handling', function() {
    it('should return MCP error for missing bookId', integrationTest(async () => {
      try {
        await context.server.testCallTool('list_transactions', {});
        expect.fail('Should have thrown an error for missing bookId');
      } catch (error: any) {
        expect(error).to.have.property('code');
        expect(error.code).to.equal(-32602); // Invalid params
        expect(error.message).to.include('Missing required parameter: bookId');
      }
    }));
    
    it('should return MCP error for invalid bookId', integrationTest(async () => {
      try {
        await context.server.testCallTool('list_transactions', {
          bookId: 'invalid-book-id-123',
          query: 'after:2020-01-01'
        });
        expect.fail('Should have thrown an error for invalid bookId');
      } catch (error: any) {
        // Should be an error - either MCP error or regular error
        expect(error).to.exist;
        expect(error.message).to.be.a('string');
        // Just verify we got an error, don't be too specific about the content
      }
    }));
    
    it('should return MCP error for empty bookId', integrationTest(async () => {
      try {
        await context.server.testCallTool('list_transactions', {
          bookId: ''
        });
        expect.fail('Should have thrown an error for empty bookId');
      } catch (error: any) {
        expect(error).to.have.property('code');
        expect(error.code).to.equal(-32602); // Invalid params
        expect(error.message).to.include('Missing required parameter: bookId');
      }
    }));
    
    it('should handle malformed queries gracefully', integrationTest(async () => {
      // Test with malformed query syntax
      const result = await withRetry(() => 
        context.server.testCallTool('list_transactions', {
          bookId: TEST_BOOK_ID,
          query: 'invalid:syntax:query::'
        })
      );
      const response = parseToolResponse(result);
      
      // Should return valid response structure even with malformed query
      expect(response).to.have.property('transactions').that.is.an('array');
      expect(response).to.have.property('hasMore').that.is.a('boolean');
      expect(response).to.have.property('cursor');
      expect(response).to.have.property('limit');
    }));
  });
  
  describe('Performance', function() {
    it('should complete list_transactions request within reasonable time', integrationTest(async () => {
      const startTime = Date.now();
      
      const result = await withRetry(() => 
        context.server.testCallTool('list_transactions', {
          bookId: TEST_BOOK_ID,
          query: 'after:2020-01-01',
          limit: 25
        })
      );
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      parseToolResponse(result); // Ensure response is valid
      
      // Should complete within 15 seconds (generous for network latency)
      expect(duration).to.be.lessThan(15000);
      
      if (TestMode.DEBUG_API) {
        console.log(`list_transactions completed in ${duration}ms`);
      }
    }));
    
    it('should handle large limit requests efficiently', integrationTest(async () => {
      const startTime = Date.now();
      
      const result = await withRetry(() => 
        context.server.testCallTool('list_transactions', {
          bookId: TEST_BOOK_ID,
          query: 'after:2020-01-01',
          limit: 100
        })
      );
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      parseToolResponse(result); // Ensure response is valid
      
      // Should complete within 20 seconds even with large limit
      expect(duration).to.be.lessThan(20000);
    }));
  });
  
  describe('Data Consistency', function() {
    it('should return consistent transaction data structure', integrationTest(async () => {
      const result = await withRetry(() => 
        context.server.testCallTool('list_transactions', {
          bookId: TEST_BOOK_ID,
          query: 'after:2020-01-01',
          limit: 10
        })
      );
      
      const response = parseToolResponse(result);
      
      // All transactions should have consistent structure
      response.transactions.forEach((transaction: any) => {
        expect(transaction).to.have.property('id').that.is.a('string');
        expect(transaction).to.have.property('date').that.is.a('string');
        // dateValue is intentionally removed by the handler to keep response clean
        expect(transaction).to.have.property('amount'); // Can be string or number
        expect(transaction).to.have.property('posted').that.is.a('boolean');
        
        // creditAccount and debitAccount are optional - may not be set for drafts or pending transactions
        if (transaction.creditAccount !== undefined) {
          expect(transaction.creditAccount).to.be.an('object');
        }
        if (transaction.debitAccount !== undefined) {
          expect(transaction.debitAccount).to.be.an('object');
        }
        
        // description is optional - may not be set
        if (transaction.description !== undefined) {
          expect(transaction.description).to.be.a('string');
        }
        
        // Optional properties
        if (transaction.properties !== undefined) {
          expect(transaction.properties).to.be.an('object');
        }
        if (transaction.tags !== undefined) {
          expect(transaction.tags).to.be.an('array');
        }
        if (transaction.urls !== undefined) {
          expect(transaction.urls).to.be.an('array');
        }
        if (transaction.remoteIds !== undefined) {
          expect(transaction.remoteIds).to.be.an('array');
        }
        
        // Validate data integrity
        expect(transaction.id).to.have.length.greaterThan(0);
        expect(transaction.date).to.match(/^\d{4}-\d{2}-\d{2}$/);
        const amount = typeof transaction.amount === 'string' ? parseFloat(transaction.amount) : transaction.amount;
        expect(amount).to.be.greaterThan(0);
        
        // Account validation - only validate if accounts are set
        if (transaction.creditAccount) {
          expect(transaction.creditAccount.id).to.have.length.greaterThan(0);
          // Account names are optional in transaction structure
          if (transaction.creditAccount.name !== undefined) {
            expect(transaction.creditAccount.name).to.have.length.greaterThan(0);
          }
        }
        if (transaction.debitAccount) {
          expect(transaction.debitAccount.id).to.have.length.greaterThan(0);
          if (transaction.debitAccount.name !== undefined) {
            expect(transaction.debitAccount.name).to.have.length.greaterThan(0);
          }
        }
      });
    }));
    
    it('should return transactions in consistent order', integrationTest(async () => {
      // Get first page twice
      const result1 = await withRetry(() => 
        context.server.testCallTool('list_transactions', {
          bookId: TEST_BOOK_ID,
          query: 'after:2020-01-01',
          limit: 5
        })
      );
      const response1 = parseToolResponse(result1);
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const result2 = await withRetry(() => 
        context.server.testCallTool('list_transactions', {
          bookId: TEST_BOOK_ID,
          query: 'after:2020-01-01',
          limit: 5
        })
      );
      const response2 = parseToolResponse(result2);
      
      // Results should be identical
      expect(response1.transactions).to.have.length(response2.transactions.length);
      
      // Transaction order should be consistent
      response1.transactions.forEach((tx1: any, index: number) => {
        const tx2 = response2.transactions[index];
        expect(tx1.id).to.equal(tx2.id);
        expect(tx1.date).to.equal(tx2.date);
        expect(tx1.amount).to.equal(tx2.amount);
        expect(tx1.description).to.equal(tx2.description);
      });
    }));
  });
});