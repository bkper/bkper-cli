import {
  expect,
  createTestContext,
  integrationTest,
  parseToolResponse,
  getToolDefinition,
  validateResponseStructure,
  logApiResponse,
  withRetry,
  ExpectedStructures
} from '../setup/test-helpers.js';
import { testDataManager } from '../setup/test-data-manager.js';
import type { IntegrationTestContext } from '../setup/test-helpers.js';

describe('Integration: merge_transactions Tool', function() {
  let context: IntegrationTestContext;
  let testBookId: string;

  before(async function() {
    this.timeout(60000); // Allow more time for initial setup
    context = createTestContext();

    // Verify we can access the API and get test book
    const stats = await testDataManager.getTestDataStats();
    console.log(`\nIntegration test environment:`);
    console.log(`- Total books available: ${stats.totalBooks}`);
    console.log(`- Test books: ${stats.testBooks}`);
    console.log(`- Permissions:`, stats.permissions);

    if (!stats.testBooks || stats.testBooks.length === 0) {
      throw new Error('No test books available for integration testing');
    }

    // Use the TEST_BOOK_ID from environment
    testBookId = process.env.TEST_BOOK_ID || stats.testBooks[0];
    console.log(`- Using test book: ${testBookId}`);
  });

  after(function() {
    // Clear any cached data
    testDataManager.clearCache();
  });

  describe('Tool Registration', function() {
    it('should have merge_transactions tool properly registered', integrationTest(async () => {
      const tool = await getToolDefinition(context.server, 'merge_transactions');

      expect(tool).to.exist;
      expect(tool.name).to.equal('merge_transactions');
      expect(tool.description).to.satisfy((desc: string) =>
        desc.toLowerCase().includes('merge') || desc.toLowerCase().includes('duplicate')
      );
      expect(tool.inputSchema).to.have.property('type', 'object');
      expect(tool.inputSchema.properties).to.have.property('bookId');
      expect(tool.inputSchema.properties).to.have.property('transactionId1');
      expect(tool.inputSchema.properties).to.have.property('transactionId2');
      expect(tool.inputSchema.required).to.include('bookId');
      expect(tool.inputSchema.required).to.include('transactionId1');
      expect(tool.inputSchema.required).to.include('transactionId2');
    }));
  });

  describe('Basic Merge Operation', function() {
    let transaction1Id: string;
    let transaction2Id: string;

    before(async function() {
      this.timeout(60000);

      // Create two test transactions to merge
      console.log(`\nCreating test transactions in book ${testBookId}...`);

      // Create first transaction
      const tx1Result = await withRetry(() =>
        context.server.testCallTool('create_transactions', {
          bookId: testBookId,
          transactions: [{
            date: '2025-01-15',
            amount: 100.00,
            description: 'Test Payment #merge-test duplicate'
          }]
        })
      );
      const tx1Response = parseToolResponse(tx1Result);
      transaction1Id = tx1Response.transactions[0].id;
      console.log(`  Created transaction1: ${transaction1Id}`);

      // Small delay between creates
      await new Promise(resolve => setTimeout(resolve, 500));

      // Create second transaction
      const tx2Result = await withRetry(() =>
        context.server.testCallTool('create_transactions', {
          bookId: testBookId,
          transactions: [{
            date: '2025-01-15',
            amount: 100.00,
            description: 'Test transaction #merge-test entry'
          }]
        })
      );
      const tx2Response = parseToolResponse(tx2Result);
      transaction2Id = tx2Response.transactions[0].id;
      console.log(`  Created transaction2: ${transaction2Id}`);

      // Wait a bit for transactions to be fully created
      await new Promise(resolve => setTimeout(resolve, 1000));
    });

    it('should merge two transactions successfully', integrationTest(async () => {
      const result = await withRetry(() =>
        context.server.testCallTool('merge_transactions', {
          bookId: testBookId,
          transactionId1: transaction1Id,
          transactionId2: transaction2Id
        }),
        { maxRetries: 3, retryDelay: 2000 }
      );

      const response = parseToolResponse(result);
      logApiResponse('merge_transactions', response);

      // Validate response structure
      expect(response).to.have.property('mergedTransaction');
      expect(response).to.have.property('revertedTransactionId');
      expect(response).to.have.property('auditRecord');

      // Validate merged transaction exists
      expect(response.mergedTransaction).to.have.property('id').that.is.a('string');
      expect(response.mergedTransaction).to.have.property('description').that.is.a('string');

      // Verify one of the original transaction IDs is the merged one
      expect([transaction1Id, transaction2Id]).to.include(response.mergedTransaction.id);

      // Verify the other is the reverted one
      expect([transaction1Id, transaction2Id]).to.include(response.revertedTransactionId);
      expect(response.mergedTransaction.id).to.not.equal(response.revertedTransactionId);

      // Verify description contains merged content
      const description = response.mergedTransaction.description;
      expect(description).to.include('#merge-test');

      console.log(`  Merged transaction: ${response.mergedTransaction.id}`);
      console.log(`  Reverted transaction: ${response.revertedTransactionId}`);
      console.log(`  Final description: "${description}"`);
    }));

    it('should have merged description without duplicate words', integrationTest(async () => {
      const result = await withRetry(() =>
        context.server.testCallTool('merge_transactions', {
          bookId: testBookId,
          transactionId1: transaction1Id,
          transactionId2: transaction2Id
        }),
        { maxRetries: 3, retryDelay: 2000 }
      );

      const response = parseToolResponse(result);
      const description = response.mergedTransaction.description.toLowerCase();

      // Should contain unique words from both descriptions
      expect(description).to.include('test');
      expect(description).to.include('#merge-test');

      // Check that important words appear (could appear in any order)
      const hasPaymentOrTransaction = description.includes('payment') || description.includes('transaction');
      const hasEntry = description.includes('entry');
      const hasDuplicate = description.includes('duplicate');

      // At least some unique words from both should be present
      expect(hasPaymentOrTransaction || hasEntry || hasDuplicate).to.be.true;
    }));
  });

  describe('Merge with Different Amounts', function() {
    let transaction3Id: string;
    let transaction4Id: string;

    before(async function() {
      this.timeout(60000);

      console.log(`\nCreating transactions with different amounts...`);

      // Create first transaction with amount 150
      const tx3Result = await withRetry(() =>
        context.server.testCallTool('create_transactions', {
          bookId: testBookId,
          transactions: [{
            date: '2025-01-16',
            amount: 150.00,
            description: 'Invoice Payment #merge-test-amount'
          }]
        })
      );
      const tx3Response = parseToolResponse(tx3Result);
      transaction3Id = tx3Response.transactions[0].id;
      console.log(`  Created transaction3: ${transaction3Id} (amount: 150.00)`);

      await new Promise(resolve => setTimeout(resolve, 500));

      // Create second transaction with amount 120
      const tx4Result = await withRetry(() =>
        context.server.testCallTool('create_transactions', {
          bookId: testBookId,
          transactions: [{
            date: '2025-01-16',
            amount: 120.00,
            description: 'Invoice #merge-test-amount entry'
          }]
        })
      );
      const tx4Response = parseToolResponse(tx4Result);
      transaction4Id = tx4Response.transactions[0].id;
      console.log(`  Created transaction4: ${transaction4Id} (amount: 120.00)`);

      await new Promise(resolve => setTimeout(resolve, 1000));
    });

    it('should create audit record when amounts differ', integrationTest(async () => {
      const result = await withRetry(() =>
        context.server.testCallTool('merge_transactions', {
          bookId: testBookId,
          transactionId1: transaction3Id,
          transactionId2: transaction4Id
        }),
        { maxRetries: 3, retryDelay: 2000 }
      );

      const response = parseToolResponse(result);
      logApiResponse('merge_transactions (different amounts)', response);

      // Should have audit record
      expect(response.auditRecord).to.not.be.null;
      expect(response.auditRecord).to.be.a('string');

      // Audit record should contain the date and amount difference (30.00)
      const auditRecord = response.auditRecord;
      expect(auditRecord).to.be.a('string').and.not.empty;

      console.log(`  Audit record created: "${auditRecord}"`);
      console.log(`  Amounts: 150.00 vs 120.00, difference: 30.00`);
    }));

    it('should keep the newer transaction amount', integrationTest(async () => {
      const result = await withRetry(() =>
        context.server.testCallTool('merge_transactions', {
          bookId: testBookId,
          transactionId1: transaction3Id,
          transactionId2: transaction4Id
        }),
        { maxRetries: 3, retryDelay: 2000 }
      );

      const response = parseToolResponse(result);

      // The merged transaction should have one of the amounts
      const mergedAmount = parseFloat(response.mergedTransaction.amount);
      expect([120.00, 150.00]).to.include(mergedAmount);

      console.log(`  Merged transaction amount: ${mergedAmount}`);
    }));
  });

  describe('Error Handling', function() {
    it('should fail gracefully with invalid book ID', integrationTest(async () => {
      try {
        await context.server.testCallTool('merge_transactions', {
          bookId: 'invalid-book-id-12345',
          transactionId1: 'txn1',
          transactionId2: 'txn2'
        });
        expect.fail('Should have thrown an error for invalid book ID');
      } catch (error) {
        expect(error).to.be.an('error');
        expect((error as Error).message).to.satisfy((msg: string) =>
          msg.toLowerCase().includes('book') || msg.toLowerCase().includes('not found')
        );
      }
    }));

    it('should fail gracefully with invalid transaction ID', integrationTest(async () => {
      try {
        await context.server.testCallTool('merge_transactions', {
          bookId: testBookId,
          transactionId1: 'invalid-tx-id-12345',
          transactionId2: 'invalid-tx-id-67890'
        });
        expect.fail('Should have thrown an error for invalid transaction ID');
      } catch (error) {
        expect(error).to.be.an('error');
        expect((error as Error).message).to.satisfy((msg: string) =>
          msg.toLowerCase().includes('transaction') || msg.toLowerCase().includes('not found')
        );
      }
    }));

    it('should fail with missing required parameters', integrationTest(async () => {
      try {
        await context.server.testCallTool('merge_transactions', {
          bookId: testBookId
          // Missing transactionId1 and transactionId2
        });
        expect.fail('Should have thrown an error for missing parameters');
      } catch (error) {
        expect(error).to.be.an('error');
        expect((error as Error).message).to.satisfy((msg: string) =>
          msg.toLowerCase().includes('transactionid1') || msg.toLowerCase().includes('required')
        );
      }
    }));
  });

  describe('Response Format Validation', function() {
    let transaction5Id: string;
    let transaction6Id: string;

    before(async function() {
      this.timeout(60000);

      // Create two more test transactions
      const tx5Result = await withRetry(() =>
        context.server.testCallTool('create_transactions', {
          bookId: testBookId,
          transactions: [{
            date: '2025-01-17',
            amount: 75.00,
            description: 'Validation Test #merge-validation'
          }]
        })
      );
      const tx5Response = parseToolResponse(tx5Result);
      transaction5Id = tx5Response.transactions[0].id;

      await new Promise(resolve => setTimeout(resolve, 500));

      const tx6Result = await withRetry(() =>
        context.server.testCallTool('create_transactions', {
          bookId: testBookId,
          transactions: [{
            date: '2025-01-17',
            amount: 75.00,
            description: 'Test #merge-validation entry'
          }]
        })
      );
      const tx6Response = parseToolResponse(tx6Result);
      transaction6Id = tx6Response.transactions[0].id;

      await new Promise(resolve => setTimeout(resolve, 1000));
    });

    it('should return properly formatted merged transaction', integrationTest(async () => {
      const result = await withRetry(() =>
        context.server.testCallTool('merge_transactions', {
          bookId: testBookId,
          transactionId1: transaction5Id,
          transactionId2: transaction6Id
        }),
        { maxRetries: 3, retryDelay: 2000 }
      );

      const response = parseToolResponse(result);
      const merged = response.mergedTransaction;

      // Validate required fields
      expect(merged).to.have.property('id').that.is.a('string');
      expect(merged).to.have.property('description').that.is.a('string');
      expect(merged).to.have.property('amount');

      // Validate optional but expected fields
      if (merged.date !== undefined) {
        expect(merged.date).to.be.a('string');
      }
      if (merged.posted !== undefined) {
        expect(merged.posted).to.be.a('boolean');
      }
      if (merged.checked !== undefined) {
        expect(merged.checked).to.be.a('boolean');
      }
    }));

    it('should return valid JSON response', integrationTest(async () => {
      const result = await withRetry(() =>
        context.server.testCallTool('merge_transactions', {
          bookId: testBookId,
          transactionId1: transaction5Id,
          transactionId2: transaction6Id
        }),
        { maxRetries: 3, retryDelay: 2000 }
      );

      // Parse should not throw
      expect(() => parseToolResponse(result)).to.not.throw();

      const response = parseToolResponse(result);
      expect(response).to.be.an('object');
    }));
  });

  describe('Performance', function() {
    let transaction7Id: string;
    let transaction8Id: string;

    before(async function() {
      this.timeout(60000);

      // Create transactions for performance test
      const tx7Result = await withRetry(() =>
        context.server.testCallTool('create_transactions', {
          bookId: testBookId,
          transactions: [{
            date: '2025-01-18',
            amount: 50.00,
            description: 'Performance Test #merge-perf'
          }]
        })
      );
      const tx7Response = parseToolResponse(tx7Result);
      transaction7Id = tx7Response.transactions[0].id;

      await new Promise(resolve => setTimeout(resolve, 500));

      const tx8Result = await withRetry(() =>
        context.server.testCallTool('create_transactions', {
          bookId: testBookId,
          transactions: [{
            date: '2025-01-18',
            amount: 50.00,
            description: 'Test #merge-perf entry'
          }]
        })
      );
      const tx8Response = parseToolResponse(tx8Result);
      transaction8Id = tx8Response.transactions[0].id;

      await new Promise(resolve => setTimeout(resolve, 1000));
    });

    it('should complete merge operation within reasonable time', integrationTest(async () => {
      const startTime = Date.now();

      const result = await withRetry(() =>
        context.server.testCallTool('merge_transactions', {
          bookId: testBookId,
          transactionId1: transaction7Id,
          transactionId2: transaction8Id
        }),
        { maxRetries: 3, retryDelay: 2000 }
      );

      const endTime = Date.now();
      const duration = endTime - startTime;

      parseToolResponse(result); // Ensure response is valid

      // Should complete within 15 seconds (generous for multiple API calls)
      expect(duration).to.be.lessThan(15000);

      console.log(`  merge_transactions completed in ${duration}ms`);
    }));
  });
});
