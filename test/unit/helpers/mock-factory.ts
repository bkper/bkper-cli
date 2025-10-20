import {
  MockBkper,
  MockBook,
  MockAccount,
  MockTransaction,
  MockBalance,
  MockAccountBalance,
  MockGroup,
  MockDataTableBuilder,
  BookData,
  AccountData,
  TransactionData,
  BalanceData,
  AccountBalanceData,
  GroupData
} from './mock-interfaces.js';
import { loadBalanceMatrixTotal, loadBalanceMatrixPeriod } from './fixture-loader.js';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

// Mock auth service
export const mockGetOAuthToken = async (): Promise<string> => 'mock-token';

// Mock DataTableBuilder implementation
function createMockDataTableBuilder(balances: AccountBalanceData[], query?: string): MockDataTableBuilder {
  let formatValues = false;
  let formatDates = false;
  let transposed = false;
  let raw = false;
  let balanceType: any = null;
  let expandedValue: number = 0;

  return {
    formatValues(format: boolean): MockDataTableBuilder {
      formatValues = format;
      return this;
    },
    formatDates(format: boolean): MockDataTableBuilder {
      formatDates = format;
      return this;
    },
    transposed(transpose: boolean): MockDataTableBuilder {
      transposed = transpose;
      return this;
    },
    raw(rawMode: boolean): MockDataTableBuilder {
      raw = rawMode;
      return this;
    },
    expanded(value: number): MockDataTableBuilder {
      expandedValue = value;
      return this;
    },
    type(type: any): MockDataTableBuilder {
      balanceType = type;
      return this;
    },
    hideNames(): MockDataTableBuilder {
      return this;
    },
    build(): any[][] {
      // Determine if this is a time-based query
      const isTimeBased = query?.includes('on:') || query?.includes('after:') || query?.includes('before:');
      
      if (isTimeBased && transposed) {
        // Period/Cumulative format - load from fixture
        try {
          const currentDir = dirname(fileURLToPath(import.meta.url));
          return loadBalanceMatrixPeriod(currentDir);
        } catch {
          // Fallback hardcoded data if fixture loading fails
          return [
            ["", "2024-01-01", "2024-01-02", "2024-01-03", "2024-01-04", "2024-01-05"],
            ["Cash", 5000.00, 6200.00, 5900.00, 8400.00, 8250.00],
            ["Accounts Receivable", 0.00, 0.00, 0.00, 0.00, 0.00],
            ["Service Revenue", -5000.00, -1200.00, 0.00, -2500.00, 0.00],
            ["Office Rent", 0.00, 0.00, 300.00, 0.00, 150.00]
          ];
        }
      } else {
        // Total format - load from fixture or generate from balances
        try {
          const currentDir = dirname(fileURLToPath(import.meta.url));
          const fixtureMatrix = loadBalanceMatrixTotal(currentDir);
          
          // If we have filtered balances, generate matrix from them
          if (balances.length < 10) { // Assuming fixture has 10 accounts
            const matrix: any[][] = [];
            balances.forEach(balance => {
              const balanceValue = parseFloat(balance.balance);
              matrix.push([balance.account.name || '', balanceValue]);
            });
            return matrix;
          }
          
          return fixtureMatrix;
        } catch {
          // Fallback to generating from balances
          const matrix: any[][] = [];
          balances.forEach(balance => {
            const balanceValue = parseFloat(balance.balance);
            matrix.push([balance.account.name || '', balanceValue]);
          });
          return matrix;
        }
      }
    }
  };
}

// Setup module mocking - centralized function used by all tests
export async function setupMocks() {
  const originalImport = await import('module');
  const ModuleClass = originalImport.Module as any;
  const originalResolveFilename = ModuleClass._resolveFilename;
  const originalLoad = ModuleClass.load;

  ModuleClass._resolveFilename = function(request: string, parent: any, isMain?: boolean) {
    if (request === 'bkper-js') {
      return 'mocked-bkper-js';
    }
    if (request.includes('local-auth-service.js')) {
      return 'mocked-auth-service';
    }
    return originalResolveFilename.call(this, request, parent, isMain);
  };

  ModuleClass.load = function(filename: string) {
    if (filename === 'mocked-bkper-js') {
      const mockBkper = (globalThis as any).__mockBkper;
      if (mockBkper) {
        (this as any).exports = { Bkper: mockBkper };
      }
      return;
    }
    if (filename === 'mocked-auth-service') {
      (this as any).exports = { getOAuthToken: mockGetOAuthToken };
      return;
    }
    return originalLoad.call(this, filename);
  };
}

// Factory for creating MockBkper instances for books listing
export function createMockBkperForBooks(books: BookData[]): MockBkper {
  return {
    setConfig: () => {},
    getBooks: async (query?: string): Promise<MockBook[]> => {
      let filteredBooks = books;
      
      // Apply name filtering if query is provided
      if (query && query.trim()) {
        filteredBooks = books.filter((book: BookData) => 
          book.name?.toLowerCase().includes(query.toLowerCase()) || false
        );
      }
      
      return filteredBooks.map((bookData: BookData) => ({
        json: (): BookData => bookData
      }));
    }
  };
}

// Factory for creating MockBkper instances for single book operations
export function createMockBkperForBook(
  books: BookData[], 
  accounts?: AccountData[], 
  transactions?: TransactionData[], 
  accountBalances?: AccountBalanceData[],
  groups?: GroupData[]
): MockBkper {
  return {
    setConfig: () => {},
    getBook: async (id: string): Promise<MockBook> => {
      const book = books.find(b => b.id === id);
      if (!book) {
        throw new Error(`Book not found: ${id}`);
      }
      
      return {
        json: (): BookData => book,
        
        // Accounts support
        getAccounts: accounts ? async (): Promise<MockAccount[]> => 
          accounts.map((accountData: AccountData) => ({
            json: (): AccountData => accountData,
            getId: (): string => accountData.id || '',
            getName: (): string => accountData.name || '',
            getType: (): string => accountData.type || ''
          })) : undefined,
        
        // Account Balances support
        getBalancesReport: accountBalances ? async (query?: string): Promise<any> => {
          let filteredBalances = accountBalances;
          
          // Handle query filtering - empty/undefined queries use 'on:$m' default
          const effectiveQuery = query || 'on:$m';
          if (effectiveQuery && effectiveQuery.trim() && effectiveQuery !== 'on:$m') {
            // Simple query simulation for testing
            if (effectiveQuery.includes("account:'Cash'")) {
              filteredBalances = accountBalances.filter(b => b.account.name === 'Cash');
            } else if (effectiveQuery.includes("group:'Assets'")) {
              filteredBalances = accountBalances.filter(b => b.account.type === 'ASSET');
            } else if (effectiveQuery.includes("group:'Liabilities'")) {
              filteredBalances = accountBalances.filter(b => b.account.type === 'LIABILITY');
            }
          }
          // For 'on:$m' default or other date queries, return all balances (no filtering in mock)
          
          return {
            getBalancesContainers: (): MockAccountBalance[] => {
              const containers = filteredBalances.map((balanceData: AccountBalanceData) => ({
                json: (): AccountBalanceData => balanceData,
                getAccount: (): MockAccount => ({
                  json: (): AccountData => balanceData.account,
                  getId: (): string => balanceData.account.id || '',
                  getName: (): string => balanceData.account.name || '',
                  getType: (): string => balanceData.account.type || ''
                }),
                getGroup: (): MockGroup | null => null,
                getName: (): string => balanceData.account.name || '',
                getPeriodBalance: (): string => balanceData.balance,
                getCumulativeBalance: (): string => balanceData.cumulative,
                createDataTable: (): MockDataTableBuilder => createMockDataTableBuilder(filteredBalances, effectiveQuery)
              }));
              
              // For matrix functionality, we need to add createDataTable to the first container
              // This simulates the real API where you call it on the first container or the report
              if (containers.length > 0) {
                containers[0].createDataTable = () => createMockDataTableBuilder(filteredBalances, effectiveQuery);
              }
              
              return containers;
            },
            createDataTable: (): MockDataTableBuilder => createMockDataTableBuilder(filteredBalances, effectiveQuery)
          };
        } : undefined,
        
        // Transactions support
        listTransactions: transactions ? async (query?: string, limit?: number, cursor?: string): Promise<any> => {
          let filteredTransactions = transactions;
          
          if (query) {
            // Simple query simulation for testing
            if (query.includes("posted:true")) {
              filteredTransactions = transactions.filter(t => t.posted === true);
            } else if (query.includes("posted:false")) {
              filteredTransactions = transactions.filter(t => t.posted === false);
            } else if (query.includes("account:'Cash'")) {
              filteredTransactions = transactions.filter(t => 
                t.creditAccount?.name === 'Cash' || t.debitAccount?.name === 'Cash'
              );
            }
          }
          
          // Simple cursor-based pagination simulation
          let startIndex = 0;
          if (cursor) {
            try {
              const cursorData = JSON.parse(Buffer.from(cursor, 'base64').toString());
              startIndex = cursorData.offset || 0;
            } catch {
              startIndex = 0; // Invalid cursor, start from beginning
            }
          }
          
          const pageSize = limit || 50;
          const endIndex = startIndex + pageSize;
          const pageTransactions = filteredTransactions.slice(startIndex, endIndex);
          const hasMore = endIndex < filteredTransactions.length;
          const nextCursor = hasMore ? 
            Buffer.from(JSON.stringify({ offset: endIndex, timestamp: Date.now() })).toString('base64') : 
            undefined;
          
          return {
            getItems: (): MockTransaction[] => pageTransactions.map((transactionData: TransactionData) => ({
              json: (): TransactionData => transactionData
            })),
            getCursor: () => nextCursor
          };
        } : undefined,
        
        // Transaction creation support
        batchCreateTransactions: transactions ? async (txArray: MockTransaction[]): Promise<MockTransaction[]> => {
          return txArray.map((tx, index) => {
            const txData = tx.json();
            // Return pre-configured fixture data if available, otherwise create from input
            const fixtureTransaction = transactions[index];
            if (fixtureTransaction) {
              return {
                json: (): TransactionData => fixtureTransaction
              };
            }
            return {
              json: (): TransactionData => ({
                ...txData,
                id: txData.id || `tx-created-${Date.now()}-${index}`,
                posted: true,
                checked: false,
                trashed: false,
                createdAt: Date.now().toString(),
                createdBy: 'test@example.com'
              })
            };
          });
        } : undefined,
        
        // Groups support
        getGroups: groups ? async (): Promise<MockGroup[]> => {
          // Create a map for quick parent lookup
          const groupMap = new Map<string, MockGroup>();
          const mockGroups: MockGroup[] = [];
          
          // First pass: create all mock groups
          groups.forEach((groupData: GroupData) => {
            const mockGroup: MockGroup = {
              getId: (): string => groupData.id || '',
              getName: (): string => groupData.name || '',
              getType: (): string => groupData.type || '',
              isHidden: (): boolean => groupData.hidden || false,
              isPermanent: (): boolean => groupData.permanent || false,
              getParent: (): MockGroup | null => null, // Will be set in second pass
              getChildren: (): MockGroup[] => [], // Will be populated in second pass
              getProperties: (): { [name: string]: string } => groupData.properties || {},
              json: (): GroupData => groupData
            };
            
            mockGroups.push(mockGroup);
            if (groupData.id) {
              groupMap.set(groupData.id, mockGroup);
            }
          });
          
          // Second pass: set up parent-child relationships
          groups.forEach((groupData: GroupData, index: number) => {
            const mockGroup = mockGroups[index];
            
            // Set parent
            if (groupData.parent?.id) {
              const parent = groupMap.get(groupData.parent.id);
              if (parent) {
                mockGroup.getParent = () => parent;
              }
            }
            
            // Collect children
            const children = mockGroups.filter((child, childIndex) => 
              groups[childIndex].parent?.id === groupData.id
            );
            mockGroup.getChildren = () => children;
          });
          
          return mockGroups;
        } : undefined
      };
    }
  };
}

// Set the mock in the module system
export function setMockBkper(mockBkper: MockBkper) {
  // This function updates the global mock that will be used by setupMocks
  // We'll use a global variable to store the current mock
  (globalThis as any).__mockBkper = mockBkper;
}