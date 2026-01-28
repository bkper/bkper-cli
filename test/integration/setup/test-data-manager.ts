import { withRetry, TestMode } from './test-helpers.js';
import { getBkperInstance } from '../../../src/bkper-factory.js';

/**
 * Manages test data for integration tests
 * Uses Bkper Factory configuration and simple environment variables
 */

export interface TestBook {
  id: string;
  name: string;
  permission: string;
  isTestBook: boolean;
}

/**
 * Test data manager for handling book selection and validation
 */
export class TestDataManager {
  private cachedBooks: TestBook[] | null = null;
  
  /**
   * Gets available books for testing
   * Prefers TEST_BOOK_ID if specified, otherwise lists all accessible books
   */
  async getTestBooks(): Promise<TestBook[]> {
    // Return cached books if available
    if (this.cachedBooks) {
      return this.cachedBooks;
    }
    
    // Get Bkper instance (uses Bkper Factory configuration)
    const bkperInstance = getBkperInstance();
    
    // If specific test book ID is provided, use only that
    const testBookId = process.env.TEST_BOOK_ID;
    if (testBookId) {
      try {
        const book = await withRetry(() => bkperInstance.getBook(testBookId));
        const bookData = book.json();
        
        this.cachedBooks = [{
          id: bookData.id!,
          name: bookData.name!,
          permission: bookData.permission || 'UNKNOWN',
          isTestBook: true
        }];
        
        if (TestMode.DEBUG_API) {
          console.log(`Using specific test book: ${bookData.name} (${bookData.id})`);
        }
        
        return this.cachedBooks;
      } catch (error) {
        console.warn(`Failed to load specific test book ${testBookId}:`, error);
        console.log('Falling back to listing all available books...');
      }
    }
    
    // List all available books
    const books = await withRetry(() => bkperInstance.getBooks());
    
    this.cachedBooks = books.map((book: any) => {
      const bookData = book.json();
      return {
        id: bookData.id!,
        name: bookData.name!,
        permission: bookData.permission || 'UNKNOWN',
        isTestBook: this.isTestBookCandidate(bookData)
      };
    });
    
    if (TestMode.DEBUG_API) {
      console.log(`Found ${this.cachedBooks.length} books for testing`);
    }
    
    return this.cachedBooks;
  }
  
  /**
   * Gets a single book for testing (prefers test books)
   */
  async getTestBook(): Promise<TestBook> {
    const books = await this.getTestBooks();
    
    if (books.length === 0) {
      throw new Error('No books available for testing');
    }
    
    // Prefer books marked as test books
    const testBook = books.find(b => b.isTestBook);
    if (testBook) {
      return testBook;
    }
    
    // Otherwise return the first available book
    return books[0];
  }
  
  /**
   * Validates if a book is safe for testing
   */
  async validateBookForTesting(bookId: string): Promise<boolean> {
    try {
      const bkperInstance = getBkperInstance();
      const book = await withRetry(() => bkperInstance.getBook(bookId));
      const bookData = book.json();
      
      // Check permissions - we need at least viewer access
      const permission = bookData.permission || '';
      const hasAccess = ['OWNER', 'EDITOR', 'POSTER', 'VIEWER'].includes(permission);
      
      if (!hasAccess) {
        if (TestMode.DEBUG_API) {
          console.log(`Book ${bookId} has insufficient permissions: ${permission}`);
        }
        return false;
      }
      
      return true;
    } catch (error) {
      if (TestMode.DEBUG_API) {
        console.log(`Failed to validate book ${bookId}:`, error);
      }
      return false;
    }
  }
  
  /**
   * Determines if a book is a good candidate for testing
   */
  private isTestBookCandidate(bookData: any): boolean {
    const name = (bookData.name || '').toLowerCase();
    
    // Look for common test book indicators
    return (
      name.includes('test') ||
      name.includes('demo') ||
      name.includes('sample') ||
      name.includes('example') ||
      name.includes('sandbox')
    );
  }
  
  /**
   * Logs book information for debugging
   */
  logBookInfo(book: TestBook): void {
    if (TestMode.DEBUG_API) {
      console.log('\n=== Test Book Info ===');
      console.log(`ID: ${book.id}`);
      console.log(`Name: ${book.name}`);
      console.log(`Permission: ${book.permission}`);
      console.log(`Is Test Book: ${book.isTestBook}`);
      console.log('====================\n');
    }
  }
  
  /**
   * Gets statistics about available test data
   */
  async getTestDataStats(): Promise<{
    totalBooks: number;
    testBooks: number;
    permissions: Record<string, number>;
  }> {
    const books = await this.getTestBooks();
    
    const permissions: Record<string, number> = {};
    let testBookCount = 0;
    
    for (const book of books) {
      permissions[book.permission] = (permissions[book.permission] || 0) + 1;
      if (book.isTestBook) {
        testBookCount++;
      }
    }
    
    return {
      totalBooks: books.length,
      testBooks: testBookCount,
      permissions
    };
  }
  
  /**
   * Clears the cached books (useful for test cleanup)
   */
  clearCache(): void {
    this.cachedBooks = null;
  }
}

// Export singleton instance
export const testDataManager = new TestDataManager();