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

describe('Integration: get_book Tool', function() {
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
    it('should have get_book tool properly registered', integrationTest(async () => {
      const tool = await getToolDefinition(context.server, 'get_book');
      
      expect(tool).to.exist;
      expect(tool.name).to.equal('get_book');
      expect(tool.description).to.include('Retrieve detailed information about a specific book');
      expect(tool.inputSchema).to.have.property('type', 'object');
      expect(tool.inputSchema.properties).to.have.property('bookId');
      expect(tool.inputSchema.required).to.include('bookId');
    }));
  });
  
  describe('Basic Functionality', function() {
    it('should get book details for valid bookId', integrationTest(async () => {
      const result = await withRetry(() => 
        context.server.testCallTool('get_book', {
          bookId: TEST_BOOK_ID
        })
      );
      
      const response = parseToolResponse(result);
      logApiResponse('get_book (valid bookId)', response);
      
      // Validate response structure
      expect(response).to.have.property('book').that.is.an('object');
      expect(response).to.have.property('readme').that.is.a('string');
      
      // Validate book properties
      const book = response.book;
      expect(book).to.have.property('id', TEST_BOOK_ID);
      expect(book).to.have.property('name').that.is.a('string');
      
      // Core properties that should always be present
      expect(book).to.have.property('permission').that.is.a('string');
      expect(book).to.have.property('visibility').that.is.a('string');
      expect(book).to.have.property('lastUpdateMs').that.is.a('string');
      
      // Created and modified are optional
      if (book.created !== undefined) {
        expect(book.created).to.be.a('string');
      }
      if (book.modified !== undefined) {
        expect(book.modified).to.be.a('string');
      }
      
      // Other properties are optional based on actual API behavior
      if (book.fracDigits !== undefined) {
        expect(book.fracDigits).to.be.a('number');
      }
      if (book.dateFormat !== undefined) {
        expect(book.dateFormat).to.be.a('string');
      }
      if (book.timeZone !== undefined) {
        expect(book.timeZone).to.be.a('string');
      }
      if (book.decimalSeparator !== undefined) {
        expect(book.decimalSeparator).to.be.a('string');
      }
      if (book.groupSeparator !== undefined) {
        expect(book.groupSeparator).to.be.a('string');
      }
      
      // Optional properties
      if (book.description !== undefined) {
        expect(book.description).to.be.a('string');
      }
      
      // Validate permission values
      expect(book.permission).to.be.oneOf(['VIEWER', 'POSTER', 'EDITOR', 'OWNER']);
      
      // Validate visibility values
      expect(book.visibility).to.be.oneOf(['PRIVATE', 'PUBLIC']);
      
      // Validate numeric values if present
      if (book.fracDigits !== undefined) {
        expect(book.fracDigits).to.be.at.least(0);
        expect(book.fracDigits).to.be.at.most(10);
      }
      
      // Validate date format if present
      if (book.dateFormat) {
        expect(book.dateFormat).to.match(/^[dMy\/\-\s]+$/);
      }
      
      
      // Validate timestamp format
      expect(book.lastUpdateMs).to.match(/^\d+$/);
      
      // Validate groups structure in book object
      const groups = response.book.groups;
      expect(groups).to.be.an('array');
      
      // If groups exist, validate structure
      if (groups.length > 0) {
        groups.forEach((group: any) => {
          expect(group).to.have.property('id').that.is.a('string');
          expect(group).to.have.property('name').that.is.a('string');
          expect(group).to.have.property('type').that.is.a('string');
          expect(group).to.have.property('hidden').that.is.a('boolean');
          expect(group).to.have.property('permanent').that.is.a('boolean');
          expect(group).to.have.property('properties').that.is.an('object');
          expect(group).to.have.property('children').that.is.an('array');
          
          // Validate group type values (allow all Bkper group types including empty and singular forms)
          expect(group.type).to.be.oneOf(['INCOMING', 'OUTGOING', 'ASSETS', 'ASSET', 'LIABILITIES', 'LIABILITY', 'EQUITY', 'EXPENSE', 'REVENUE', '']);
          
          // Recursively validate children structure
          if (group.children.length > 0) {
            group.children.forEach((child: any) => {
              expect(child).to.have.property('id').that.is.a('string');
              expect(child).to.have.property('name').that.is.a('string');
              expect(child).to.have.property('type').that.is.a('string');
              expect(child).to.have.property('hidden').that.is.a('boolean');
              expect(child).to.have.property('permanent').that.is.a('boolean');
              expect(child).to.have.property('properties').that.is.an('object');
              expect(child).to.have.property('children').that.is.an('array');
            });
          }
        });
      }
      
      // Log book details for debugging
      if (TestMode.DEBUG_API) {
        console.log(`Book details:`);
        console.log(`- Name: ${book.name}`);
        console.log(`- Description: ${book.description || 'N/A'}`);
        console.log(`- Permission: ${book.permission}`);
        console.log(`- Visibility: ${book.visibility}`);
        console.log(`- Decimal places: ${book.fracDigits}`);
        console.log(`- Time zone: ${book.timeZone}`);
        console.log(`- Date format: ${book.dateFormat}`);
        console.log(`- Groups: ${groups.length} root groups, ${response.totalGroups} total`);
      }
    }));
    
    it('should get book with consistent structure on repeated calls', integrationTest(async () => {
      // First call
      const result1 = await withRetry(() => 
        context.server.testCallTool('get_book', {
          bookId: TEST_BOOK_ID
        })
      );
      const response1 = parseToolResponse(result1);
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Second call
      const result2 = await withRetry(() => 
        context.server.testCallTool('get_book', {
          bookId: TEST_BOOK_ID
        })
      );
      const response2 = parseToolResponse(result2);
      
      // Results should be consistent
      expect(response1.book.id).to.equal(response2.book.id);
      expect(response1.book.name).to.equal(response2.book.name);
      expect(response1.book.permission).to.equal(response2.book.permission);
      expect(response1.book.visibility).to.equal(response2.book.visibility);
      expect(response1.book.fracDigits).to.equal(response2.book.fracDigits);
      expect(response1.book.timeZone).to.equal(response2.book.timeZone);
      expect(response1.book.dateFormat).to.equal(response2.book.dateFormat);
      
      // Groups should be consistent
      expect(response1.book.groups).to.be.an('array');
      expect(response2.book.groups).to.be.an('array');
      expect(response1.book.groups.length).to.equal(response2.book.groups.length);
      
      // Compare optional properties if they exist
      if (response1.book.description !== undefined && response2.book.description !== undefined) {
        expect(response1.book.description).to.equal(response2.book.description);
      }
      
      // Timestamps might differ slightly but should be very close
      const lastUpdate1 = parseInt(response1.book.lastUpdateMs);
      const lastUpdate2 = parseInt(response2.book.lastUpdateMs);
      const timeDiff = Math.abs(lastUpdate1 - lastUpdate2);
      expect(timeDiff).to.be.lessThan(60000); // Within 1 minute
    }));
    
    it('should return groups with hierarchical structure', integrationTest(async () => {
      const result = await withRetry(() => 
        context.server.testCallTool('get_book', {
          bookId: TEST_BOOK_ID
        })
      );
      
      const response = parseToolResponse(result);
      logApiResponse('get_book (groups validation)', response);
      
      // Validate groups structure
      expect(response.book.groups).to.be.an('array');
      
      if (response.book.groups.length > 0) {
        
        // Verify root groups have no parent references (should be hierarchical)
        response.book.groups.forEach((group: any) => {
          expect(group).to.not.have.property('parent');
        });
        
        // Log groups structure for debugging
        if (TestMode.DEBUG_API) {
          console.log(`Groups structure:`);
          console.log(`- Root groups: ${response.groups.length}`);
          console.log(`- Total groups: ${response.totalGroups}`);
          response.groups.forEach((group: any, index: number) => {
            console.log(`  ${index + 1}. ${group.name} (${group.type}) - ${group.children.length} children`);
          });
        }
      }
    }));
  });
  
  describe('Error Handling', function() {
    it('should return MCP error for missing bookId', integrationTest(async () => {
      try {
        await context.server.testCallTool('get_book', {});
        expect.fail('Should have thrown an error for missing bookId');
      } catch (error: any) {
        expect(error).to.have.property('code');
        expect(error.code).to.equal(-32602); // Invalid params
        expect(error.message).to.include('Missing required parameter: bookId');
      }
    }));
    
    it('should return MCP error for invalid bookId', integrationTest(async () => {
      try {
        await context.server.testCallTool('get_book', {
          bookId: 'invalid-book-id-123'
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
        await context.server.testCallTool('get_book', {
          bookId: ''
        });
        expect.fail('Should have thrown an error for empty bookId');
      } catch (error: any) {
        expect(error).to.have.property('code');
        expect(error.code).to.equal(-32602); // Invalid params
        expect(error.message).to.include('Missing required parameter: bookId');
      }
    }));
    
    it('should return MCP error for null bookId', integrationTest(async () => {
      try {
        await context.server.testCallTool('get_book', {
          bookId: null as any
        });
        expect.fail('Should have thrown an error for null bookId');
      } catch (error: any) {
        expect(error).to.have.property('code');
        expect(error.code).to.equal(-32602); // Invalid params
        expect(error.message).to.include('Missing required parameter: bookId');
      }
    }));
  });
  
  describe('Performance', function() {
    it('should complete get_book request within reasonable time', integrationTest(async () => {
      const startTime = Date.now();
      
      const result = await withRetry(() => 
        context.server.testCallTool('get_book', {
          bookId: TEST_BOOK_ID
        })
      );
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      parseToolResponse(result); // Ensure response is valid
      
      // Should complete within 10 seconds (generous for network latency)
      expect(duration).to.be.lessThan(10000);
      
      if (TestMode.DEBUG_API) {
        console.log(`get_book completed in ${duration}ms`);
      }
    }));
  });
  
  describe('Book Data Validation', function() {
    it('should have valid book configuration', integrationTest(async () => {
      const result = await withRetry(() => 
        context.server.testCallTool('get_book', {
          bookId: TEST_BOOK_ID
        })
      );
      
      const response = parseToolResponse(result);
      const book = response.book;
      
      // Validate that the book has reasonable configuration
      expect(book.name).to.have.length.greaterThan(0);
      expect(book.name).to.have.length.lessThan(256);
      
      
      // Decimal configuration - only validate if present
      if (book.fracDigits !== undefined) {
        expect(book.fracDigits).to.be.at.least(0);
        expect(book.fracDigits).to.be.at.most(10);
      }
      
      // Separators - only validate if present (can be words like "COMMA" or symbols)
      if (book.decimalSeparator) {
        expect(book.decimalSeparator).to.be.a('string');
        expect(book.decimalSeparator).to.have.length.greaterThan(0);
      }
      if (book.groupSeparator) {
        expect(book.groupSeparator).to.be.a('string');
        expect(book.groupSeparator).to.have.length.greaterThan(0);
      }
      if (book.decimalSeparator && book.groupSeparator) {
        expect(book.decimalSeparator).to.not.equal(book.groupSeparator);
      }
      
      // Time zone - only validate if present
      if (book.timeZone) {
        expect(book.timeZone).to.have.length.greaterThan(0);
        expect(book.timeZone).to.have.length.lessThan(100);
      }
      
      // Date format - only validate if present
      if (book.dateFormat) {
        expect(book.dateFormat).to.have.length.greaterThan(0);
        expect(book.dateFormat).to.have.length.lessThan(50);
      }
      
      // Timestamps should be valid
      const lastUpdateMs = parseInt(book.lastUpdateMs);
      expect(lastUpdateMs).to.be.greaterThan(0);
      expect(lastUpdateMs).to.be.lessThan(Date.now() + 86400000); // Not more than 1 day in future
      
      // Created and modified should be valid ISO dates if present
      if (book.created) {
        expect(book.created).to.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/);
      }
      if (book.modified) {
        expect(book.modified).to.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/);
      }
    }));
  });
});