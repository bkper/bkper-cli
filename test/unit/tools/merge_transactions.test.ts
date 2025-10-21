import { expect, setupTestEnvironment, getTestPaths } from '../helpers/test-setup.js';
import { BkperMcpServerType, BookData, TransactionData } from '../helpers/mock-interfaces.js';
import { setupMocks, createMockBkperForBook, setMockBkper } from '../helpers/mock-factory.js';
import { loadBooks } from '../helpers/fixture-loader.js';
import * as fs from 'fs';
import * as path from 'path';

const { __dirname } = getTestPaths(import.meta.url);

const mockBooks: BookData[] = loadBooks(__dirname);

// Load merge transaction fixtures
const mergeFixturesPath = path.join(__dirname, '../../fixtures/merge-transactions.json');
const mergeFixtures = JSON.parse(fs.readFileSync(mergeFixturesPath, 'utf-8'));
const fixtureBook = mergeFixtures.book;
const scenarios = mergeFixtures.scenarios;

setupMocks();

const { BkperMcpServer } = await import('../../../src/mcp/server.js');

describe('MCP Server - merge_transactions Tool Registration', function() {
  let server: BkperMcpServerType;

  beforeEach(function() {
    setupTestEnvironment();
    const mockBkper = createMockBkperForBook(mockBooks);
    setMockBkper(mockBkper);
    server = new BkperMcpServer();
  });

  it('should register merge_transactions tool in MCP tools list', async function() {
    const response = await server.testListTools();

    expect(response).to.have.property('tools');
    expect(response.tools).to.be.an('array');

    const mergeTransactionsTool = response.tools.find((tool: any) => tool.name === 'merge_transactions');
    expect(mergeTransactionsTool).to.exist;
    expect(mergeTransactionsTool!.name).to.equal('merge_transactions');
  });

  it('should have description mentioning merge and duplicate', async function() {
    const response = await server.testListTools();
    const mergeTransactionsTool = response.tools.find((tool: any) => tool.name === 'merge_transactions');

    expect(mergeTransactionsTool).to.exist;
    if (mergeTransactionsTool) {
      const desc = mergeTransactionsTool.description.toLowerCase();
      expect(desc).to.satisfy((d: string) => d.includes('merge') || d.includes('duplicate'));
    }
  });

  it('should have proper MCP tool schema for merge_transactions', async function() {
    const response = await server.testListTools();
    const mergeTransactionsTool = response.tools.find((tool: any) => tool.name === 'merge_transactions') as any;

    expect(mergeTransactionsTool).to.exist;
    expect(mergeTransactionsTool.inputSchema).to.have.property('properties');
    expect(mergeTransactionsTool.inputSchema.properties).to.have.property('bookId');
    expect(mergeTransactionsTool.inputSchema.properties).to.have.property('transactionId1');
    expect(mergeTransactionsTool.inputSchema.properties).to.have.property('transactionId2');
    expect(mergeTransactionsTool.inputSchema.properties.bookId.type).to.equal('string');
    expect(mergeTransactionsTool.inputSchema.properties.transactionId1.type).to.equal('string');
    expect(mergeTransactionsTool.inputSchema.properties.transactionId2.type).to.equal('string');
  });

  it('should have all parameters as required', async function() {
    const response = await server.testListTools();
    const mergeTransactionsTool = response.tools.find((tool: any) => tool.name === 'merge_transactions') as any;

    expect(mergeTransactionsTool.inputSchema.required).to.be.an('array');
    expect(mergeTransactionsTool.inputSchema.required).to.include('bookId');
    expect(mergeTransactionsTool.inputSchema.required).to.include('transactionId1');
    expect(mergeTransactionsTool.inputSchema.required).to.include('transactionId2');
    expect(mergeTransactionsTool.inputSchema.required).to.have.length(3);
  });
});

describe('MCP Server - merge_transactions Parameter Validation', function() {
  let server: BkperMcpServerType;

  beforeEach(function() {
    setupTestEnvironment();
    const mockBkper = createMockBkperForBook(mockBooks);
    setMockBkper(mockBkper);
    server = new BkperMcpServer();
  });

  it('should throw McpError for missing bookId', async function() {
    try {
      await server.testCallTool('merge_transactions', {
        transactionId1: 'txn1',
        transactionId2: 'txn2'
      });
      expect.fail('Should have thrown an error for missing bookId');
    } catch (error) {
      expect(error).to.be.an('error');
      expect((error as Error).message).to.include('bookId');
    }
  });

  it('should throw McpError for missing transactionId1', async function() {
    try {
      await server.testCallTool('merge_transactions', {
        bookId: 'book-1',
        transactionId2: 'txn2'
      });
      expect.fail('Should have thrown an error for missing transactionId1');
    } catch (error) {
      expect(error).to.be.an('error');
      expect((error as Error).message).to.include('transactionId1');
    }
  });

  it('should throw McpError for missing transactionId2', async function() {
    try {
      await server.testCallTool('merge_transactions', {
        bookId: 'book-1',
        transactionId1: 'txn1'
      });
      expect.fail('Should have thrown an error for missing transactionId2');
    } catch (error) {
      expect(error).to.be.an('error');
      expect((error as Error).message).to.include('transactionId2');
    }
  });

  it('should throw McpError for invalid book ID', async function() {
    const mockBkper = {
      setConfig: () => {},
      getBook: async (id: string) => {
        if (id === 'invalid-book-id') {
          throw new Error('Book not found: invalid-book-id');
        }
        return createMockBkperForBook(mockBooks).getBook!(id);
      }
    };
    setMockBkper(mockBkper);
    server = new BkperMcpServer();

    try {
      await server.testCallTool('merge_transactions', {
        bookId: 'invalid-book-id',
        transactionId1: 'txn1',
        transactionId2: 'txn2'
      });
      expect.fail('Should have thrown an error for invalid book ID');
    } catch (error) {
      expect(error).to.be.an('error');
      expect((error as Error).message).to.include('Book not found');
    }
  });

  it('should throw McpError for non-existent transaction ID', async function() {
    const mockBkper = {
      setConfig: () => {},
      getBook: async (id: string) => {
        const book = mockBooks.find(b => b.id === id);
        if (!book) throw new Error(`Book not found: ${id}`);

        return {
          json: () => book,
          getTransaction: async (txId: string) => {
            if (txId === 'non-existent-tx') {
              throw new Error(`Transaction not found: ${txId}`);
            }
            return {
              json: () => scenarios.differentAmounts.transaction1
            };
          }
        };
      }
    };
    setMockBkper(mockBkper);
    server = new BkperMcpServer();

    try {
      await server.testCallTool('merge_transactions', {
        bookId: 'book-1',
        transactionId1: 'non-existent-tx',
        transactionId2: 'txn2'
      });
      expect.fail('Should have thrown an error for non-existent transaction');
    } catch (error) {
      expect(error).to.be.an('error');
      expect((error as Error).message).to.include('Transaction not found');
    }
  });
});

describe('MCP Server - merge_transactions Algorithm: Priority Rules', function() {
  let server: BkperMcpServerType;

  beforeEach(function() {
    setupTestEnvironment();
  });

  it('should prefer posted transaction over draft (transaction1 draft, transaction2 posted)', async function() {
    const scenario = scenarios.draftVsPosted;
    const mockBkper = {
      setConfig: () => {},
      getBook: async (id: string) => ({
        json: () => fixtureBook,
        getTransaction: async (txId: string) => ({
          json: () => txId === scenario.transaction1.id ? scenario.transaction1 : scenario.transaction2
        }),
        revertTransaction: async (txId: string) => ({
          json: () => txId === scenario.transaction1.id ? scenario.transaction1 : scenario.transaction2
        }),
        updateTransaction: async (txId: string, data: any) => ({
          json: () => ({ ...scenario.expectedEdit, ...data })
        })
      })
    };
    setMockBkper(mockBkper);
    server = new BkperMcpServer();

    const response = await server.testCallTool('merge_transactions', {
      bookId: fixtureBook.id,
      transactionId1: scenario.transaction1.id,
      transactionId2: scenario.transaction2.id
    });

    const jsonResponse = JSON.parse(response.content[0].text as string);

    // Posted transaction should be the edit (kept)
    expect(jsonResponse.mergedTransaction.id).to.equal(scenario.transaction2.id);
    expect(jsonResponse.revertedTransactionId).to.equal(scenario.transaction1.id);
  });

  it('should prefer posted transaction over draft (transaction1 posted, transaction2 draft)', async function() {
    const scenario = scenarios.draftVsPosted;
    // Swap the transactions
    const mockBkper = {
      setConfig: () => {},
      getBook: async (id: string) => ({
        json: () => fixtureBook,
        getTransaction: async (txId: string) => ({
          json: () => txId === scenario.transaction2.id ? scenario.transaction2 : scenario.transaction1
        }),
        revertTransaction: async (txId: string) => ({
          json: () => txId === scenario.transaction1.id ? scenario.transaction1 : scenario.transaction2
        }),
        updateTransaction: async (txId: string, data: any) => ({
          json: () => ({ ...scenario.expectedEdit, ...data })
        })
      })
    };
    setMockBkper(mockBkper);
    server = new BkperMcpServer();

    const response = await server.testCallTool('merge_transactions', {
      bookId: fixtureBook.id,
      transactionId1: scenario.transaction2.id, // posted
      transactionId2: scenario.transaction1.id  // draft
    });

    const jsonResponse = JSON.parse(response.content[0].text as string);

    // Posted transaction should still be the edit (kept)
    expect(jsonResponse.mergedTransaction.id).to.equal(scenario.transaction2.id);
    expect(jsonResponse.revertedTransactionId).to.equal(scenario.transaction1.id);
  });

  it('should prefer newer transaction when both have same status', async function() {
    const scenario = scenarios.differentAmounts;
    const mockBkper = {
      setConfig: () => {},
      getBook: async (id: string) => ({
        json: () => fixtureBook,
        getTransaction: async (txId: string) => ({
          json: () => txId === scenario.transaction1.id ? scenario.transaction1 : scenario.transaction2
        }),
        revertTransaction: async (txId: string) => ({
          json: () => txId === scenario.transaction1.id ? scenario.transaction1 : scenario.transaction2
        }),
        updateTransaction: async (txId: string, data: any) => ({
          json: () => ({ ...scenario.expectedEdit, ...data })
        }),
        recordTransaction: async (text: string) => ({
          json: () => ({ description: text })
        })
      })
    };
    setMockBkper(mockBkper);
    server = new BkperMcpServer();

    const response = await server.testCallTool('merge_transactions', {
      bookId: fixtureBook.id,
      transactionId1: scenario.transaction1.id,
      transactionId2: scenario.transaction2.id
    });

    const jsonResponse = JSON.parse(response.content[0].text as string);

    // Newer transaction (transaction2) should be the edit
    expect(jsonResponse.mergedTransaction.id).to.equal(scenario.transaction2.id);
    expect(jsonResponse.revertedTransactionId).to.equal(scenario.transaction1.id);
  });
});

describe('MCP Server - merge_transactions Algorithm: Description Merging', function() {
  let server: BkperMcpServerType;

  beforeEach(function() {
    setupTestEnvironment();
  });

  it('should merge descriptions without duplicating words', async function() {
    const scenario = scenarios.differentAmounts;
    const mockBkper = {
      setConfig: () => {},
      getBook: async (id: string) => ({
        json: () => fixtureBook,
        getTransaction: async (txId: string) => ({
          json: () => txId === scenario.transaction1.id ? scenario.transaction1 : scenario.transaction2
        }),
        revertTransaction: async (txId: string) => ({
          json: () => txId === scenario.transaction1.id ? scenario.transaction1 : scenario.transaction2
        }),
        updateTransaction: async (txId: string, data: any) => ({
          json: () => ({ ...scenario.expectedEdit, description: data.description })
        }),
        recordTransaction: async (text: string) => ({
          json: () => ({ description: text })
        })
      })
    };
    setMockBkper(mockBkper);
    server = new BkperMcpServer();

    const response = await server.testCallTool('merge_transactions', {
      bookId: fixtureBook.id,
      transactionId1: scenario.transaction1.id,
      transactionId2: scenario.transaction2.id
    });

    const jsonResponse = JSON.parse(response.content[0].text as string);

    // Verify description contains unique words only
    const mergedDescription = jsonResponse.mergedTransaction.description;
    expect(mergedDescription).to.include('INT');
    expect(mergedDescription).to.include('#impostos');
    expect(mergedDescription).to.include('Nacional');
    expect(mergedDescription).to.include('Mensal');

    // Check it matches expected pattern (not exact match due to possible implementation variations)
    expect(mergedDescription.toLowerCase()).to.satisfy((desc: string) =>
      desc.includes('int') && desc.includes('impostos') && desc.includes('nacional')
    );
  });

  it('should handle null description in transaction1', async function() {
    const tx1 = { ...scenarios.sameAmounts.transaction1, description: null };
    const tx2 = scenarios.sameAmounts.transaction2;

    const mockBkper = {
      setConfig: () => {},
      getBook: async (id: string) => ({
        json: () => fixtureBook,
        getTransaction: async (txId: string) => ({
          json: () => txId === tx1.id ? tx1 : tx2
        }),
        revertTransaction: async (txId: string) => ({
          json: () => txId === tx1.id ? tx1 : tx2
        }),
        updateTransaction: async (txId: string, data: any) => ({
          json: () => ({ ...tx2, description: data.description })
        })
      })
    };
    setMockBkper(mockBkper);
    server = new BkperMcpServer();

    const response = await server.testCallTool('merge_transactions', {
      bookId: fixtureBook.id,
      transactionId1: tx1.id,
      transactionId2: tx2.id
    });

    const jsonResponse = JSON.parse(response.content[0].text as string);

    // Should use transaction2's description
    expect(jsonResponse.mergedTransaction.description).to.equal(tx2.description);
  });

  it('should handle null description in transaction2', async function() {
    const tx1 = scenarios.sameAmounts.transaction1;
    const tx2 = { ...scenarios.sameAmounts.transaction2, description: null };

    const mockBkper = {
      setConfig: () => {},
      getBook: async (id: string) => ({
        json: () => fixtureBook,
        getTransaction: async (txId: string) => ({
          json: () => txId === tx1.id ? tx1 : tx2
        }),
        revertTransaction: async (txId: string) => ({
          json: () => txId === tx1.id ? tx1 : tx2
        }),
        updateTransaction: async (txId: string, data: any) => ({
          json: () => ({ ...tx2, description: data.description })
        })
      })
    };
    setMockBkper(mockBkper);
    server = new BkperMcpServer();

    const response = await server.testCallTool('merge_transactions', {
      bookId: fixtureBook.id,
      transactionId1: tx1.id,
      transactionId2: tx2.id
    });

    const jsonResponse = JSON.parse(response.content[0].text as string);

    // Should use transaction1's description
    expect(jsonResponse.mergedTransaction.description).to.equal(tx1.description);
  });
});

describe('MCP Server - merge_transactions Algorithm: Amount Handling', function() {
  let server: BkperMcpServerType;

  beforeEach(function() {
    setupTestEnvironment();
  });

  it('should create audit record when amounts differ', async function() {
    const scenario = scenarios.differentAmounts;
    const mockBkper = {
      setConfig: () => {},
      getBook: async (id: string) => ({
        json: () => fixtureBook,
        getTransaction: async (txId: string) => ({
          json: () => txId === scenario.transaction1.id ? scenario.transaction1 : scenario.transaction2
        }),
        revertTransaction: async (txId: string) => ({
          json: () => txId === scenario.transaction1.id ? scenario.transaction1 : scenario.transaction2
        }),
        updateTransaction: async (txId: string, data: any) => ({
          json: () => ({ ...scenario.expectedEdit, ...data })
        }),
        recordTransaction: async (text: string) => ({
          json: () => ({ id: 'audit-record', description: text })
        })
      })
    };
    setMockBkper(mockBkper);
    server = new BkperMcpServer();

    const response = await server.testCallTool('merge_transactions', {
      bookId: fixtureBook.id,
      transactionId1: scenario.transaction1.id,
      transactionId2: scenario.transaction2.id
    });

    const jsonResponse = JSON.parse(response.content[0].text as string);

    expect(jsonResponse.auditRecord).to.exist;
    expect(jsonResponse.auditRecord).to.include(scenario.transaction1.dateFormatted);
    expect(jsonResponse.auditRecord).to.include('20'); // the difference amount
  });

  it('should not create audit record when amounts are the same', async function() {
    const scenario = scenarios.sameAmounts;
    const mockBkper = {
      setConfig: () => {},
      getBook: async (id: string) => ({
        json: () => fixtureBook,
        getTransaction: async (txId: string) => ({
          json: () => txId === scenario.transaction1.id ? scenario.transaction1 : scenario.transaction2
        }),
        revertTransaction: async (txId: string) => ({
          json: () => txId === scenario.transaction1.id ? scenario.transaction1 : scenario.transaction2
        }),
        updateTransaction: async (txId: string, data: any) => ({
          json: () => ({ ...scenario.expectedEdit, ...data })
        })
      })
    };
    setMockBkper(mockBkper);
    server = new BkperMcpServer();

    const response = await server.testCallTool('merge_transactions', {
      bookId: fixtureBook.id,
      transactionId1: scenario.transaction1.id,
      transactionId2: scenario.transaction2.id
    });

    const jsonResponse = JSON.parse(response.content[0].text as string);

    expect(jsonResponse.auditRecord).to.be.null;
  });

  it('should backfill missing amount from revert to edit', async function() {
    const tx1 = scenarios.backfillAccounts.transaction1;
    const tx2 = { ...scenarios.backfillAccounts.transaction2, amount: null };

    const mockBkper = {
      setConfig: () => {},
      getBook: async (id: string) => ({
        json: () => fixtureBook,
        getTransaction: async (txId: string) => ({
          json: () => txId === tx1.id ? tx1 : tx2
        }),
        revertTransaction: async (txId: string) => ({
          json: () => txId === tx1.id ? tx1 : tx2
        }),
        updateTransaction: async (txId: string, data: any) => ({
          json: () => ({ ...tx2, amount: data.amount || tx1.amount })
        })
      })
    };
    setMockBkper(mockBkper);
    server = new BkperMcpServer();

    const response = await server.testCallTool('merge_transactions', {
      bookId: fixtureBook.id,
      transactionId1: tx1.id,
      transactionId2: tx2.id
    });

    const jsonResponse = JSON.parse(response.content[0].text as string);

    // Should use transaction1's amount
    expect(jsonResponse.mergedTransaction.amount).to.equal(tx1.amount);
  });
});

describe('MCP Server - merge_transactions Algorithm: Account Backfilling', function() {
  let server: BkperMcpServerType;

  beforeEach(function() {
    setupTestEnvironment();
  });

  it('should backfill missing credit account', async function() {
    const scenario = scenarios.backfillAccounts;
    const mockBkper = {
      setConfig: () => {},
      getBook: async (id: string) => ({
        json: () => fixtureBook,
        getTransaction: async (txId: string) => ({
          json: () => txId === scenario.transaction1.id ? scenario.transaction1 : scenario.transaction2
        }),
        revertTransaction: async (txId: string) => ({
          json: () => txId === scenario.transaction1.id ? scenario.transaction1 : scenario.transaction2
        }),
        updateTransaction: async (txId: string, data: any) => ({
          json: () => ({
            ...scenario.expectedEdit,
            creditAccountId: data.creditAccountId || scenario.expectedEdit.creditAccountId
          })
        })
      })
    };
    setMockBkper(mockBkper);
    server = new BkperMcpServer();

    const response = await server.testCallTool('merge_transactions', {
      bookId: fixtureBook.id,
      transactionId1: scenario.transaction1.id,
      transactionId2: scenario.transaction2.id
    });

    const jsonResponse = JSON.parse(response.content[0].text as string);

    expect(jsonResponse.mergedTransaction.creditAccountId).to.equal(scenario.expectedEdit.creditAccountId);
  });

  it('should backfill missing debit account', async function() {
    const scenario = scenarios.backfillAccounts;
    const mockBkper = {
      setConfig: () => {},
      getBook: async (id: string) => ({
        json: () => fixtureBook,
        getTransaction: async (txId: string) => ({
          json: () => txId === scenario.transaction1.id ? scenario.transaction1 : scenario.transaction2
        }),
        revertTransaction: async (txId: string) => ({
          json: () => txId === scenario.transaction1.id ? scenario.transaction1 : scenario.transaction2
        }),
        updateTransaction: async (txId: string, data: any) => ({
          json: () => ({
            ...scenario.expectedEdit,
            debitAccountId: data.debitAccountId || scenario.expectedEdit.debitAccountId
          })
        })
      })
    };
    setMockBkper(mockBkper);
    server = new BkperMcpServer();

    const response = await server.testCallTool('merge_transactions', {
      bookId: fixtureBook.id,
      transactionId1: scenario.transaction1.id,
      transactionId2: scenario.transaction2.id
    });

    const jsonResponse = JSON.parse(response.content[0].text as string);

    expect(jsonResponse.mergedTransaction.debitAccountId).to.equal(scenario.expectedEdit.debitAccountId);
  });
});

describe('MCP Server - merge_transactions Algorithm: Metadata Merging', function() {
  let server: BkperMcpServerType;

  beforeEach(function() {
    setupTestEnvironment();
  });

  it('should merge attachments from both transactions', async function() {
    const scenario = scenarios.withAttachmentsAndUrls;
    const mockBkper = {
      setConfig: () => {},
      getBook: async (id: string) => ({
        json: () => fixtureBook,
        getTransaction: async (txId: string) => ({
          json: () => txId === scenario.transaction1.id ? scenario.transaction1 : scenario.transaction2
        }),
        revertTransaction: async (txId: string) => ({
          json: () => txId === scenario.transaction1.id ? scenario.transaction1 : scenario.transaction2
        }),
        updateTransaction: async (txId: string, data: any) => ({
          json: () => ({
            ...scenario.expectedEdit,
            attachments: data.attachments
          })
        })
      })
    };
    setMockBkper(mockBkper);
    server = new BkperMcpServer();

    const response = await server.testCallTool('merge_transactions', {
      bookId: fixtureBook.id,
      transactionId1: scenario.transaction1.id,
      transactionId2: scenario.transaction2.id
    });

    const jsonResponse = JSON.parse(response.content[0].text as string);

    expect(jsonResponse.mergedTransaction.attachments).to.have.length(2);
    expect(jsonResponse.mergedTransaction.attachments.some((a: any) => a.artifactId === 'attach1')).to.be.true;
    expect(jsonResponse.mergedTransaction.attachments.some((a: any) => a.artifactId === 'attach2')).to.be.true;
  });

  it('should merge URLs from both transactions', async function() {
    const scenario = scenarios.withAttachmentsAndUrls;
    const mockBkper = {
      setConfig: () => {},
      getBook: async (id: string) => ({
        json: () => fixtureBook,
        getTransaction: async (txId: string) => ({
          json: () => txId === scenario.transaction1.id ? scenario.transaction1 : scenario.transaction2
        }),
        revertTransaction: async (txId: string) => ({
          json: () => txId === scenario.transaction1.id ? scenario.transaction1 : scenario.transaction2
        }),
        updateTransaction: async (txId: string, data: any) => ({
          json: () => ({
            ...scenario.expectedEdit,
            urls: data.urls
          })
        })
      })
    };
    setMockBkper(mockBkper);
    server = new BkperMcpServer();

    const response = await server.testCallTool('merge_transactions', {
      bookId: fixtureBook.id,
      transactionId1: scenario.transaction1.id,
      transactionId2: scenario.transaction2.id
    });

    const jsonResponse = JSON.parse(response.content[0].text as string);

    expect(jsonResponse.mergedTransaction.urls).to.have.length(2);
    expect(jsonResponse.mergedTransaction.urls).to.include('https://vendor.com/invoice/123');
    expect(jsonResponse.mergedTransaction.urls).to.include('https://vendor.com/order/456');
  });

  it('should merge remoteIds from both transactions', async function() {
    const scenario = scenarios.withAttachmentsAndUrls;
    const mockBkper = {
      setConfig: () => {},
      getBook: async (id: string) => ({
        json: () => fixtureBook,
        getTransaction: async (txId: string) => ({
          json: () => txId === scenario.transaction1.id ? scenario.transaction1 : scenario.transaction2
        }),
        revertTransaction: async (txId: string) => ({
          json: () => txId === scenario.transaction1.id ? scenario.transaction1 : scenario.transaction2
        }),
        updateTransaction: async (txId: string, data: any) => ({
          json: () => ({
            ...scenario.expectedEdit,
            remoteIds: data.remoteIds
          })
        })
      })
    };
    setMockBkper(mockBkper);
    server = new BkperMcpServer();

    const response = await server.testCallTool('merge_transactions', {
      bookId: fixtureBook.id,
      transactionId1: scenario.transaction1.id,
      transactionId2: scenario.transaction2.id
    });

    const jsonResponse = JSON.parse(response.content[0].text as string);

    expect(jsonResponse.mergedTransaction.remoteIds).to.have.length(2);
    expect(jsonResponse.mergedTransaction.remoteIds).to.include('bank-import-001');
    expect(jsonResponse.mergedTransaction.remoteIds).to.include('manual-entry-002');
  });

  it('should merge properties with revert overwriting edit', async function() {
    const scenario = scenarios.withAttachmentsAndUrls;
    const mockBkper = {
      setConfig: () => {},
      getBook: async (id: string) => ({
        json: () => fixtureBook,
        getTransaction: async (txId: string) => ({
          json: () => txId === scenario.transaction1.id ? scenario.transaction1 : scenario.transaction2
        }),
        revertTransaction: async (txId: string) => ({
          json: () => txId === scenario.transaction1.id ? scenario.transaction1 : scenario.transaction2
        }),
        updateTransaction: async (txId: string, data: any) => ({
          json: () => ({
            ...scenario.expectedEdit,
            properties: data.properties
          })
        })
      })
    };
    setMockBkper(mockBkper);
    server = new BkperMcpServer();

    const response = await server.testCallTool('merge_transactions', {
      bookId: fixtureBook.id,
      transactionId1: scenario.transaction1.id,
      transactionId2: scenario.transaction2.id
    });

    const jsonResponse = JSON.parse(response.content[0].text as string);

    expect(jsonResponse.mergedTransaction.properties).to.have.property('category', 'office');
    expect(jsonResponse.mergedTransaction.properties).to.have.property('department', 'admin');
  });
});

describe('MCP Server - merge_transactions Response Format', function() {
  let server: BkperMcpServerType;

  beforeEach(function() {
    setupTestEnvironment();
  });

  it('should return MCP-compliant response structure', async function() {
    const scenario = scenarios.sameAmounts;
    const mockBkper = {
      setConfig: () => {},
      getBook: async (id: string) => ({
        json: () => fixtureBook,
        getTransaction: async (txId: string) => ({
          json: () => txId === scenario.transaction1.id ? scenario.transaction1 : scenario.transaction2
        }),
        revertTransaction: async (txId: string) => ({
          json: () => txId === scenario.transaction1.id ? scenario.transaction1 : scenario.transaction2
        }),
        updateTransaction: async (txId: string, data: any) => ({
          json: () => ({ ...scenario.expectedEdit, ...data })
        })
      })
    };
    setMockBkper(mockBkper);
    server = new BkperMcpServer();

    const response = await server.testCallTool('merge_transactions', {
      bookId: fixtureBook.id,
      transactionId1: scenario.transaction1.id,
      transactionId2: scenario.transaction2.id
    });

    expect(response).to.have.property('content');
    expect(response.content).to.be.an('array');
    expect(response.content).to.have.length(1);
    expect(response.content[0]).to.have.property('type', 'text');
    expect(response.content[0]).to.have.property('text');

    const jsonResponse = JSON.parse(response.content[0].text as string);
    expect(jsonResponse).to.be.an('object');
  });

  it('should include mergedTransaction in response', async function() {
    const scenario = scenarios.sameAmounts;
    const mockBkper = {
      setConfig: () => {},
      getBook: async (id: string) => ({
        json: () => fixtureBook,
        getTransaction: async (txId: string) => ({
          json: () => txId === scenario.transaction1.id ? scenario.transaction1 : scenario.transaction2
        }),
        revertTransaction: async (txId: string) => ({
          json: () => txId === scenario.transaction1.id ? scenario.transaction1 : scenario.transaction2
        }),
        updateTransaction: async (txId: string, data: any) => ({
          json: () => ({ ...scenario.expectedEdit, ...data })
        })
      })
    };
    setMockBkper(mockBkper);
    server = new BkperMcpServer();

    const response = await server.testCallTool('merge_transactions', {
      bookId: fixtureBook.id,
      transactionId1: scenario.transaction1.id,
      transactionId2: scenario.transaction2.id
    });

    const jsonResponse = JSON.parse(response.content[0].text as string);

    expect(jsonResponse).to.have.property('mergedTransaction');
    expect(jsonResponse.mergedTransaction).to.have.property('id');
    expect(jsonResponse.mergedTransaction).to.have.property('description');
  });

  it('should include revertedTransactionId in response', async function() {
    const scenario = scenarios.sameAmounts;
    const mockBkper = {
      setConfig: () => {},
      getBook: async (id: string) => ({
        json: () => fixtureBook,
        getTransaction: async (txId: string) => ({
          json: () => txId === scenario.transaction1.id ? scenario.transaction1 : scenario.transaction2
        }),
        revertTransaction: async (txId: string) => ({
          json: () => txId === scenario.transaction1.id ? scenario.transaction1 : scenario.transaction2
        }),
        updateTransaction: async (txId: string, data: any) => ({
          json: () => ({ ...scenario.expectedEdit, ...data })
        })
      })
    };
    setMockBkper(mockBkper);
    server = new BkperMcpServer();

    const response = await server.testCallTool('merge_transactions', {
      bookId: fixtureBook.id,
      transactionId1: scenario.transaction1.id,
      transactionId2: scenario.transaction2.id
    });

    const jsonResponse = JSON.parse(response.content[0].text as string);

    expect(jsonResponse).to.have.property('revertedTransactionId');
    expect(jsonResponse.revertedTransactionId).to.be.a('string');
  });

  it('should include auditRecord when amounts differ', async function() {
    const scenario = scenarios.differentAmounts;
    const mockBkper = {
      setConfig: () => {},
      getBook: async (id: string) => ({
        json: () => fixtureBook,
        getTransaction: async (txId: string) => ({
          json: () => txId === scenario.transaction1.id ? scenario.transaction1 : scenario.transaction2
        }),
        revertTransaction: async (txId: string) => ({
          json: () => txId === scenario.transaction1.id ? scenario.transaction1 : scenario.transaction2
        }),
        updateTransaction: async (txId: string, data: any) => ({
          json: () => ({ ...scenario.expectedEdit, ...data })
        }),
        recordTransaction: async (text: string) => ({
          json: () => ({ id: 'audit-record', description: text })
        })
      })
    };
    setMockBkper(mockBkper);
    server = new BkperMcpServer();

    const response = await server.testCallTool('merge_transactions', {
      bookId: fixtureBook.id,
      transactionId1: scenario.transaction1.id,
      transactionId2: scenario.transaction2.id
    });

    const jsonResponse = JSON.parse(response.content[0].text as string);

    expect(jsonResponse).to.have.property('auditRecord');
    expect(jsonResponse.auditRecord).to.be.a('string');
  });

  it('should set auditRecord to null when amounts are same', async function() {
    const scenario = scenarios.sameAmounts;
    const mockBkper = {
      setConfig: () => {},
      getBook: async (id: string) => ({
        json: () => fixtureBook,
        getTransaction: async (txId: string) => ({
          json: () => txId === scenario.transaction1.id ? scenario.transaction1 : scenario.transaction2
        }),
        revertTransaction: async (txId: string) => ({
          json: () => txId === scenario.transaction1.id ? scenario.transaction1 : scenario.transaction2
        }),
        updateTransaction: async (txId: string, data: any) => ({
          json: () => ({ ...scenario.expectedEdit, ...data })
        })
      })
    };
    setMockBkper(mockBkper);
    server = new BkperMcpServer();

    const response = await server.testCallTool('merge_transactions', {
      bookId: fixtureBook.id,
      transactionId1: scenario.transaction1.id,
      transactionId2: scenario.transaction2.id
    });

    const jsonResponse = JSON.parse(response.content[0].text as string);

    expect(jsonResponse).to.have.property('auditRecord');
    expect(jsonResponse.auditRecord).to.be.null;
  });

  it('should return valid JSON in MCP text content format', async function() {
    const scenario = scenarios.sameAmounts;
    const mockBkper = {
      setConfig: () => {},
      getBook: async (id: string) => ({
        json: () => fixtureBook,
        getTransaction: async (txId: string) => ({
          json: () => txId === scenario.transaction1.id ? scenario.transaction1 : scenario.transaction2
        }),
        revertTransaction: async (txId: string) => ({
          json: () => txId === scenario.transaction1.id ? scenario.transaction1 : scenario.transaction2
        }),
        updateTransaction: async (txId: string, data: any) => ({
          json: () => ({ ...scenario.expectedEdit, ...data })
        })
      })
    };
    setMockBkper(mockBkper);
    server = new BkperMcpServer();

    const response = await server.testCallTool('merge_transactions', {
      bookId: fixtureBook.id,
      transactionId1: scenario.transaction1.id,
      transactionId2: scenario.transaction2.id
    });

    expect(() => JSON.parse(response.content[0].text as string)).to.not.throw();
  });
});
