import fs from 'fs';
import path from 'path';
import {
    BookData,
    AccountData,
    TransactionData,
    BalanceData,
    AccountBalanceData,
    AppData,
    Group,
} from './mock-interfaces.js';

// Centralized fixture loading
export function loadFixture<T>(testDir: string, fixtureName: string): T[] {
    // testDir is the directory containing the test file
    // Navigate to test/unit/fixtures/ from any test directory
    let fixturePath: string;
    if (testDir.includes('/unit/commands/apps') || testDir.includes('/unit/tools/')) {
        // Nested directories like test/unit/commands/apps/ or test/unit/tools/subdir/
        fixturePath = path.join(testDir, '..', '..', 'fixtures', fixtureName);
    } else if (testDir.includes('/unit/tools') || testDir.includes('/unit/commands')) {
        fixturePath = path.join(testDir, '..', 'fixtures', fixtureName);
    } else if (testDir.includes('/unit')) {
        fixturePath = path.join(testDir, 'fixtures', fixtureName);
    } else {
        // Fallback for other locations
        fixturePath = path.join(testDir, 'fixtures', fixtureName);
    }
    return JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
}

export function loadFixtureObject<T>(testDir: string, fixtureName: string): T {
    let fixturePath: string;
    if (testDir.includes('/unit/commands/apps') || testDir.includes('/unit/tools/')) {
        // Nested directories like test/unit/commands/apps/ or test/unit/tools/subdir/
        fixturePath = path.join(testDir, '..', '..', 'fixtures', fixtureName);
    } else if (testDir.includes('/unit/tools') || testDir.includes('/unit/commands')) {
        fixturePath = path.join(testDir, '..', 'fixtures', fixtureName);
    } else if (testDir.includes('/unit')) {
        fixturePath = path.join(testDir, 'fixtures', fixtureName);
    } else {
        fixturePath = path.join(testDir, 'fixtures', fixtureName);
    }
    return JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
}

// Load specific fixture types
export function loadBooks(testDir: string): BookData[] {
    return loadFixture<BookData>(testDir, 'sample-books.json');
}

export function loadLargeBooks(testDir: string): BookData[] {
    return loadFixture<BookData>(testDir, 'large-books-dataset.json');
}

export function loadAccounts(testDir: string): AccountData[] {
    return loadFixture<AccountData>(testDir, 'sample-accounts.json');
}

export function loadTransactions(testDir: string): TransactionData[] {
    return loadFixture<TransactionData>(testDir, 'sample-transactions.json');
}

export function loadBalances(testDir: string): BalanceData[] {
    return loadFixture<BalanceData>(testDir, 'sample-balances.json');
}

export function loadAccountBalances(testDir: string): AccountBalanceData[] {
    return loadFixture<AccountBalanceData>(testDir, 'sample-account-balances.json');
}

export interface TransactionInput {
    date: string;
    amount: number;
    from_account: string;
    to_account: string;
    description: string;
}

export function loadTransactionTexts(testDir: string): {
    validTransactions: TransactionInput[];
    createdTransactions: TransactionData[];
} {
    return loadFixtureObject<{
        validTransactions: TransactionInput[];
        createdTransactions: TransactionData[];
    }>(testDir, 'sample-transaction-texts.json');
}

export function loadBalanceMatrixTotal(testDir: string): any[][] {
    return loadFixture<any[]>(testDir, 'sample-balance-matrix-total.json');
}

export function loadBalanceMatrixPeriod(testDir: string): any[][] {
    return loadFixture<any[]>(testDir, 'sample-balance-matrix-period.json');
}

export function loadApps(testDir: string): AppData[] {
    return loadFixture<AppData>(testDir, 'sample-apps.json');
}

// Large dataset generators for pagination testing
export function generateLargeAccounts(count: number = 150): AccountData[] {
    return Array.from({ length: count }, (_, i) => ({
        id: `account-${i + 1}`,
        name: `Account ${i + 1}`,
        normalizedName: `account_${i + 1}`,
        type: ['ASSET', 'LIABILITY', 'INCOMING', 'OUTGOING'][i % 4] as any,
        balance: Math.floor(Math.random() * 10000).toString(),
        credit: ['LIABILITY', 'INCOMING'].includes(['ASSET', 'LIABILITY', 'INCOMING', 'OUTGOING'][i % 4]),
        groups: [
            {
                id: `group-${Math.floor(i / 10)}`,
                name: `Group ${Math.floor(i / 10)}`,
                hidden: false,
                properties: {},
            },
        ],
        properties: {},
        archived: false,
        permanent: false,
        hasTransactionPosted: Math.random() > 0.3,
        agentId: 'agent-123',
        createdAt: '1640995200000',
    }));
}

export function generateLargeTransactions(count: number = 500): TransactionData[] {
    return Array.from({ length: count }, (_, i) => ({
        id: `txn-${i + 1}`,
        date: `2024-01-${String((i % 30) + 1).padStart(2, '0')}`,
        dateValue: Date.now() + i * 24 * 60 * 60 * 1000,
        amount: (Math.floor(Math.random() * 5000) + 100).toString(),
        description: `Transaction ${i + 1} - ${
            ['Service payment', 'Equipment purchase', 'Utility bill', 'Office rent', 'Consulting fee'][i % 5]
        }`,
        posted: Math.random() > 0.1, // 90% posted
        checked: Math.random() > 0.5,
        trashed: false,
        agentId: 'agent-123',
        createdAt: (Date.now() + i * 24 * 60 * 60 * 1000).toString(),
        createdBy: 'test@example.com',
        creditAccount: {
            id: `account-${(i % 10) + 1}`,
            name: `Account ${(i % 10) + 1}`,
            type: ['ASSET', 'LIABILITY', 'INCOMING', 'OUTGOING'][i % 4] as any,
        },
        debitAccount: {
            id: `account-${((i + 1) % 10) + 1}`,
            name: `Account ${((i + 1) % 10) + 1}`,
            type: ['ASSET', 'LIABILITY', 'INCOMING', 'OUTGOING'][(i + 1) % 4] as any,
        },
        properties: { batch: String(Math.floor(i / 50)) },
        tags: ['generated', 'test'],
        urls: [],
        remoteIds: [],
    }));
}

export function generateLargeBalances(count: number = 150): BalanceData[] {
    return Array.from({ length: count }, (_, i) => ({
        year: 2024,
        month: Math.floor(i / 31) + 1,
        day: (i % 31) + 1,
        fuzzyDate: 20240000 + (Math.floor(i / 31) + 1) * 100 + ((i % 31) + 1),
        periodBalance: (Math.floor(Math.random() * 2000) - 1000).toString(),
        periodCredit: Math.floor(Math.random() * 1500).toString(),
        periodDebit: Math.floor(Math.random() * 1500).toString(),
        cumulativeBalance: (Math.floor(Math.random() * 10000) - 5000).toString(),
        cumulativeCredit: Math.floor(Math.random() * 15000).toString(),
        cumulativeDebit: Math.floor(Math.random() * 10000).toString(),
    }));
}

export function generateLargeAccountBalances(count: number = 150): AccountBalanceData[] {
    return Array.from({ length: count }, (_, i) => ({
        account: {
            id: `account-${i + 1}`,
            name: `Account ${i + 1}`,
            type: ['ASSET', 'LIABILITY', 'INCOMING', 'OUTGOING'][i % 4] as any,
            balance: (Math.floor(Math.random() * 10000) - 5000).toString(),
            credit: ['LIABILITY', 'INCOMING'].includes(['ASSET', 'LIABILITY', 'INCOMING', 'OUTGOING'][i % 4]),
        },
        balance: (Math.floor(Math.random() * 10000) - 5000).toString(),
        cumulative: Math.abs(Math.floor(Math.random() * 10000)).toString(),
    }));
}
