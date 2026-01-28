import { expect } from 'chai';
import { BkperMcpServer } from '../../../src/mcp/server.js';
import type { 
  CallToolResult
} from '@modelcontextprotocol/sdk/types.js';

/**
 * Simplified integration test setup utilities
 * Uses Bkper Factory configuration (no duplicate config needed)
 */

// Re-export chai expect for convenience
export { expect };

/**
 * Default test book ID for integration tests
 * Can be overridden by TEST_BOOK_ID environment variable
 */
export const DEFAULT_TEST_BOOK_ID = 'agtzfmJrcGVyLWhyZHITCxIGTGVkZ2VyGICA4IyGifUJDA';

/**
 * Gets the test book ID from environment variable or uses default
 */
export function getTestBookId(): string {
  return process.env.TEST_BOOK_ID || DEFAULT_TEST_BOOK_ID;
}

/**
 * Test mode configuration using environment variables directly
 */
export const TestMode = {
  // Whether to log API requests/responses for debugging
  DEBUG_API: process.env.DEBUG_API === 'true',
} as const;

/**
 * Expected API response structures for validation
 */
export const ExpectedStructures = {
  // Book structure based on bkper-api-types
  book: {
    required: ['id', 'name'] as string[],
    optional: ['ownerName', 'permission', 'collection', 'datePattern', 'decimalSeparator', 
               'timeZone', 'timeZoneOffset', 'lastUpdateMs', 'fractionDigits', 'groups', 
               'properties', 'accounts', 'paymentMethods', 'connections', 'bots', 'apps',
               'lock', 'lockDate', 'visibility'] as string[]
  },
  
  // Account structure
  account: {
    required: ['id', 'name', 'type'] as string[],
    optional: ['normalizedName', 'balance', 'credit', 'groups', 'properties', 
               'archived', 'permanent', 'hasTransactionPosted', 'agentId', 'createdAt'] as string[]
  },
  
  // Transaction structure
  transaction: {
    required: ['id', 'date', 'amount'] as string[],
    optional: ['dateValue', 'description', 'posted', 'checked', 'trashed', 
               'agentId', 'createdAt', 'createdBy', 'creditAccount', 'debitAccount',
               'properties', 'tags', 'urls', 'remoteIds', 'attachments', 'files'] as string[]
  },
  
  // Balance structure
  balance: {
    required: ['account'] as string[],
    optional: ['balance', 'cumulative'] as string[]
  }
};

/**
 * Creates an MCP server instance for integration testing
 * Uses Bkper Factory configuration automatically
 */
export function createTestMcpServer(): BkperMcpServer {
  return new BkperMcpServer();
}

/**
 * Wraps an async test with proper error handling and timeout
 */
export function integrationTest(
  testFn: () => Promise<void>,
  timeout: number = 30000
): () => Promise<void> {
  return async function(this: Mocha.Context) {
    this.timeout(timeout);
    
    try {
      await testFn.call(this);
    } catch (error) {
      // Enhanced error logging for debugging
      if (TestMode.DEBUG_API) {
        console.error('Integration test error:', error);
      }
      throw error;
    }
  };
}

/**
 * Retry logic for flaky API operations
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  retryDelay: number = 1000
): Promise<T> {
  let lastError: Error | undefined;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      
      // Don't retry on non-transient errors
      if (isNonTransientError(error)) {
        throw error;
      }
      
      if (attempt < maxRetries) {
        if (TestMode.DEBUG_API) {
          console.log(`Retry attempt ${attempt + 1}/${maxRetries} after ${retryDelay}ms`);
        }
        await sleep(retryDelay);
      }
    }
  }
  
  throw lastError;
}

/**
 * Determines if an error is non-transient (should not be retried)
 */
function isNonTransientError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      message.includes('unauthorized') ||
      message.includes('forbidden') ||
      message.includes('not found') ||
      message.includes('bad request')
    );
  }
  return false;
}

/**
 * Sleep utility for delays
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Validates that a response has the expected structure
 */
export function validateResponseStructure(
  response: any,
  expectedStructure: { required: string[]; optional?: string[] }
): void {
  // Check required fields
  for (const field of expectedStructure.required) {
    expect(response, `Missing required field: ${field}`).to.have.property(field);
  }
  
  // If in debug mode, log unexpected fields
  if (TestMode.DEBUG_API && expectedStructure.optional) {
    const allExpectedFields = [
      ...expectedStructure.required,
      ...(expectedStructure.optional || [])
    ];
    const responseFields = Object.keys(response);
    const unexpectedFields = responseFields.filter(
      field => !allExpectedFields.includes(field)
    );
    
    if (unexpectedFields.length > 0) {
      console.log('Unexpected fields in response:', unexpectedFields);
    }
  }
}

/**
 * Parses MCP tool response and validates it
 */
export function parseToolResponse<T = any>(result: CallToolResult): T {
  expect(result).to.have.property('content');
  expect(result.content).to.be.an('array');
  expect(result.content).to.have.length.greaterThan(0);
  expect(result.content[0]).to.have.property('type', 'text');
  expect(result.content[0]).to.have.property('text');
  
  const text = result.content[0].text as string;
  
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`Failed to parse MCP response as JSON: ${error}`);
  }
}

/**
 * Gets a specific tool definition from the tools list
 */
export async function getToolDefinition(
  server: BkperMcpServer,
  toolName: string
): Promise<any> {
  const response = await server.testListTools();
  const tool = response.tools.find((t: any) => t.name === toolName);
  
  if (!tool) {
    throw new Error(`Tool '${toolName}' not found in MCP tools list`);
  }
  
  return tool;
}

/**
 * Test context for shared state within a test suite
 */
export interface IntegrationTestContext {
  server: BkperMcpServer;
  // Add more shared state as needed
}

/**
 * Creates a test context with common setup
 */
export function createTestContext(): IntegrationTestContext {
  return {
    server: createTestMcpServer(),
  };
}

/**
 * Logs API response for debugging (only in debug mode)
 */
export function logApiResponse(operation: string, response: any): void {
  if (TestMode.DEBUG_API) {
    console.log(`\n=== ${operation} ===`);
    console.log(JSON.stringify(response, null, 2));
    console.log('=================\n');
  }
}