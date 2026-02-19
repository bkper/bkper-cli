import { expect } from 'chai';
import {
    isApiAvailable,
    getApiUrl,
    createTestBook,
    deleteTestBook,
    runBkper,
    runBkperJson,
    runBkperWithStdin,
    uniqueTestName,
} from '../helpers/api-helpers.js';

describe('CLI - pipeline (end-to-end)', function () {
    this.timeout(120000);

    let bookA: string;
    let bookB: string;

    before(async function () {
        const available = await isApiAvailable();
        if (!available) {
            console.log(`    Skipping: API not available at ${getApiUrl()}`);
            this.skip();
        }

        const nameA = uniqueTestName('test-pipe-a');
        const nameB = uniqueTestName('test-pipe-b');
        bookA = await createTestBook(nameA);
        bookB = await createTestBook(nameB);
    });

    after(async function () {
        if (bookA) await deleteTestBook(bookA);
        if (bookB) await deleteTestBook(bookB);
    });

    // ----------------------------------------------------------------
    // Groups: round-trip piping
    // ----------------------------------------------------------------

    describe('groups round-trip', function () {
        it('should pipe group list output as group create input', async function () {
            // Seed groups in book A
            const seedResult = await runBkperWithStdin(
                ['group', 'create', '-b', bookA],
                JSON.stringify([{ name: 'Pipe Group Alpha' }, { name: 'Pipe Group Beta' }])
            );
            expect(seedResult.exitCode).to.equal(0);

            // List groups from book A as JSON
            const listResult = await runBkper(['--format', 'json', 'group', 'list', '-b', bookA]);
            expect(listResult.exitCode).to.equal(0);
            const listedGroups = JSON.parse(listResult.stdout);
            expect(listedGroups).to.be.an('array');
            expect(listedGroups.length).to.be.greaterThanOrEqual(2);

            // Pipe list output into book B create
            const pipeResult = await runBkperWithStdin(
                ['group', 'create', '-b', bookB],
                listResult.stdout
            );
            expect(pipeResult.exitCode).to.equal(0);

            // Verify groups exist in book B
            const verifyResult = await runBkperJson<bkper.Group[]>(['group', 'list', '-b', bookB]);
            const names = verifyResult.map(g => g.name);
            expect(names).to.include('Pipe Group Alpha');
            expect(names).to.include('Pipe Group Beta');
        });

        it('should pipe group batch create output as group create input', async function () {
            // Create groups in book A via batch
            const createResult = await runBkperWithStdin(
                ['group', 'create', '-b', bookA],
                JSON.stringify([{ name: 'Batch Pipe Group X' }])
            );
            expect(createResult.exitCode).to.equal(0);

            // Parse batch output (flat JSON array) and pipe to book B
            const parsed = JSON.parse(createResult.stdout);
            expect(parsed).to.be.an('array').with.length(1);

            const pipeResult = await runBkperWithStdin(
                ['group', 'create', '-b', bookB],
                createResult.stdout
            );
            expect(pipeResult.exitCode).to.equal(0);

            // Verify
            const verifyResult = await runBkperJson<bkper.Group[]>(['group', 'list', '-b', bookB]);
            const names = verifyResult.map(g => g.name);
            expect(names).to.include('Batch Pipe Group X');
        });

        it('should pipe single group get output as group create input', async function () {
            // Get a group from book A
            const groups = await runBkperJson<bkper.Group[]>(['group', 'list', '-b', bookA]);
            const targetGroup = groups.find(g => g.name === 'Pipe Group Alpha');
            expect(targetGroup).to.exist;

            const getResult = await runBkper([
                '--format',
                'json',
                'group',
                'get',
                targetGroup!.id!,
                '-b',
                bookA,
            ]);
            expect(getResult.exitCode).to.equal(0);

            // Pipe single group JSON into create (single object -> one-item batch)
            // Create in a fresh book to avoid name collision
            const bookC = await createTestBook(uniqueTestName('test-pipe-grp-get'));
            try {
                const pipeResult = await runBkperWithStdin(
                    ['group', 'create', '-b', bookC],
                    getResult.stdout
                );
                expect(pipeResult.exitCode).to.equal(0);

                const verifyResult = await runBkperJson<bkper.Group[]>([
                    'group',
                    'list',
                    '-b',
                    bookC,
                ]);
                const names = verifyResult.map(g => g.name);
                expect(names).to.include('Pipe Group Alpha');
            } finally {
                await deleteTestBook(bookC);
            }
        });
    });

    // ----------------------------------------------------------------
    // Accounts: round-trip piping
    // ----------------------------------------------------------------

    describe('accounts round-trip', function () {
        it('should pipe account list output as account create input', async function () {
            // Seed accounts in book A
            const seedResult = await runBkperWithStdin(
                ['account', 'create', '-b', bookA],
                JSON.stringify([
                    { name: 'Pipe Cash', type: 'ASSET' },
                    { name: 'Pipe Revenue', type: 'INCOMING' },
                    { name: 'Pipe Expenses', type: 'OUTGOING' },
                ])
            );
            expect(seedResult.exitCode).to.equal(0);

            // List accounts from book A as JSON
            const listResult = await runBkper(['--format', 'json', 'account', 'list', '-b', bookA]);
            expect(listResult.exitCode).to.equal(0);
            const listedAccounts = JSON.parse(listResult.stdout);
            expect(listedAccounts).to.be.an('array');
            expect(listedAccounts.length).to.be.greaterThanOrEqual(3);

            // Pipe list output into a fresh book (to avoid name collisions with bookB)
            const bookC = await createTestBook(uniqueTestName('test-pipe-acct-list'));
            try {
                const pipeResult = await runBkperWithStdin(
                    ['account', 'create', '-b', bookC],
                    listResult.stdout
                );
                expect(pipeResult.exitCode).to.equal(0);

                // Verify accounts exist in book C
                const verifyResult = await runBkperJson<bkper.Account[]>([
                    'account',
                    'list',
                    '-b',
                    bookC,
                ]);
                const names = verifyResult.map(a => a.name);
                expect(names).to.include('Pipe Cash');
                expect(names).to.include('Pipe Revenue');
                expect(names).to.include('Pipe Expenses');
            } finally {
                await deleteTestBook(bookC);
            }
        });

        it('should pipe account batch create output as account create input', async function () {
            // Create accounts in book A via batch
            const createResult = await runBkperWithStdin(
                ['account', 'create', '-b', bookA],
                JSON.stringify([{ name: 'Batch Pipe Acct Y', type: 'ASSET' }])
            );
            expect(createResult.exitCode).to.equal(0);

            // Parse batch output (flat JSON array) and pipe to a fresh book
            const parsed = JSON.parse(createResult.stdout);
            expect(parsed).to.be.an('array').with.length(1);

            const bookC = await createTestBook(uniqueTestName('test-pipe-acct-batch'));
            try {
                const pipeResult = await runBkperWithStdin(
                    ['account', 'create', '-b', bookC],
                    createResult.stdout
                );
                expect(pipeResult.exitCode).to.equal(0);

                const verifyResult = await runBkperJson<bkper.Account[]>([
                    'account',
                    'list',
                    '-b',
                    bookC,
                ]);
                const names = verifyResult.map(a => a.name);
                expect(names).to.include('Batch Pipe Acct Y');
            } finally {
                await deleteTestBook(bookC);
            }
        });

        it('should pipe single account get output as account create input', async function () {
            // Get an account from book A
            const accounts = await runBkperJson<bkper.Account[]>(['account', 'list', '-b', bookA]);
            const targetAcct = accounts.find(a => a.name === 'Pipe Cash');
            expect(targetAcct).to.exist;

            const getResult = await runBkper([
                '--format',
                'json',
                'account',
                'get',
                targetAcct!.id!,
                '-b',
                bookA,
            ]);
            expect(getResult.exitCode).to.equal(0);

            // Pipe single account JSON into create
            const bookC = await createTestBook(uniqueTestName('test-pipe-acct-get'));
            try {
                const pipeResult = await runBkperWithStdin(
                    ['account', 'create', '-b', bookC],
                    getResult.stdout
                );
                expect(pipeResult.exitCode).to.equal(0);

                const verifyResult = await runBkperJson<bkper.Account[]>([
                    'account',
                    'list',
                    '-b',
                    bookC,
                ]);
                const names = verifyResult.map(a => a.name);
                expect(names).to.include('Pipe Cash');
            } finally {
                await deleteTestBook(bookC);
            }
        });
    });

    // ----------------------------------------------------------------
    // Transactions: round-trip piping
    // ----------------------------------------------------------------

    describe('transactions round-trip', function () {
        before(async function () {
            // Ensure book B has the accounts needed for transaction creation
            await runBkperWithStdin(
                ['account', 'create', '-b', bookB],
                JSON.stringify([
                    { name: 'Pipe Cash', type: 'ASSET' },
                    { name: 'Pipe Revenue', type: 'INCOMING' },
                    { name: 'Pipe Expenses', type: 'OUTGOING' },
                ])
            );
        });

        it('should pipe transaction list output as transaction create input', async function () {
            // Seed transactions in book A
            const seedResult = await runBkperWithStdin(
                ['transaction', 'create', '-b', bookA],
                JSON.stringify([
                    {
                        date: '2025-06-01',
                        amount: '500',
                        description: 'Pipe tx sale',
                        creditAccount: { name: 'Pipe Revenue' },
                        debitAccount: { name: 'Pipe Cash' },
                    },
                    {
                        date: '2025-06-02',
                        amount: '100',
                        description: 'Pipe tx expense',
                        creditAccount: { name: 'Pipe Cash' },
                        debitAccount: { name: 'Pipe Expenses' },
                    },
                ])
            );
            expect(seedResult.exitCode).to.equal(0);

            // List transactions from book A as JSON
            const listResult = await runBkper([
                '--format',
                'json',
                'transaction',
                'list',
                '-b',
                bookA,
                '-q',
                'after:2025-05-31',
            ]);
            expect(listResult.exitCode).to.equal(0);
            const listedTx = JSON.parse(listResult.stdout);
            expect(listedTx).to.be.an('array');
            expect(listedTx.length).to.be.greaterThanOrEqual(2);

            // Pipe list output into book B create
            const pipeResult = await runBkperWithStdin(
                ['transaction', 'create', '-b', bookB],
                listResult.stdout
            );
            expect(pipeResult.exitCode).to.equal(0);
            const created = JSON.parse(pipeResult.stdout);
            expect(created).to.be.an('array');
            expect(created.length).to.be.greaterThanOrEqual(2);

            // Verify transactions exist in book B
            const verifyResult = await runBkper([
                '--format',
                'json',
                'transaction',
                'list',
                '-b',
                bookB,
                '-q',
                'after:2025-05-31',
            ]);
            expect(verifyResult.exitCode).to.equal(0);
            const bookBTx = JSON.parse(verifyResult.stdout);
            const descriptions = bookBTx.map((t: bkper.Transaction) => t.description);
            expect(descriptions).to.include('Pipe tx sale');
            expect(descriptions).to.include('Pipe tx expense');
        });

        it('should pipe transaction batch create output as transaction create input', async function () {
            // Create transactions in book A via batch
            const createResult = await runBkperWithStdin(
                ['transaction', 'create', '-b', bookA],
                JSON.stringify([
                    {
                        date: '2025-07-01',
                        amount: '250',
                        description: 'Batch pipe tx',
                        creditAccount: { name: 'Pipe Revenue' },
                        debitAccount: { name: 'Pipe Cash' },
                    },
                ])
            );
            expect(createResult.exitCode).to.equal(0);

            // Parse batch output (flat JSON array) and pipe to book B
            const parsed = JSON.parse(createResult.stdout);
            expect(parsed).to.be.an('array').with.length(1);

            const pipeResult = await runBkperWithStdin(
                ['transaction', 'create', '-b', bookB],
                createResult.stdout
            );
            expect(pipeResult.exitCode).to.equal(0);

            // Verify
            const verifyResult = await runBkper([
                '--format',
                'json',
                'transaction',
                'list',
                '-b',
                bookB,
                '-q',
                'after:2025-06-30',
            ]);
            expect(verifyResult.exitCode).to.equal(0);
            const bookBTx = JSON.parse(verifyResult.stdout);
            const descriptions = bookBTx.map((t: bkper.Transaction) => t.description);
            expect(descriptions).to.include('Batch pipe tx');
        });
    });

    // ----------------------------------------------------------------
    // Stdin wrapper: { items: [...] } backward compatibility
    // ----------------------------------------------------------------

    describe('stdin { items: [...] } wrapper', function () {
        it('should accept { items: [...] } wrapper for group create', async function () {
            const bookC = await createTestBook(uniqueTestName('test-pipe-wrap-grp'));
            try {
                const wrappedInput = JSON.stringify({
                    items: [{ name: 'Wrapped Group' }],
                });

                const result = await runBkperWithStdin(
                    ['group', 'create', '-b', bookC],
                    wrappedInput
                );
                expect(result.exitCode).to.equal(0);

                const verifyResult = await runBkperJson<bkper.Group[]>([
                    'group',
                    'list',
                    '-b',
                    bookC,
                ]);
                const names = verifyResult.map(g => g.name);
                expect(names).to.include('Wrapped Group');
            } finally {
                await deleteTestBook(bookC);
            }
        });

        it('should accept { items: [...] } wrapper for account create', async function () {
            const bookC = await createTestBook(uniqueTestName('test-pipe-wrap-acct'));
            try {
                const wrappedInput = JSON.stringify({
                    items: [
                        { name: 'Wrapped Cash', type: 'ASSET' },
                        { name: 'Wrapped Revenue', type: 'INCOMING' },
                    ],
                });

                const result = await runBkperWithStdin(
                    ['account', 'create', '-b', bookC],
                    wrappedInput
                );
                expect(result.exitCode).to.equal(0);

                const verifyResult = await runBkperJson<bkper.Account[]>([
                    'account',
                    'list',
                    '-b',
                    bookC,
                ]);
                const names = verifyResult.map(a => a.name);
                expect(names).to.include('Wrapped Cash');
                expect(names).to.include('Wrapped Revenue');
            } finally {
                await deleteTestBook(bookC);
            }
        });

        it('should accept { items: [...] } wrapper for transaction create', async function () {
            const bookC = await createTestBook(uniqueTestName('test-pipe-wrap-tx'));
            try {
                // Seed accounts first
                await runBkperWithStdin(
                    ['account', 'create', '-b', bookC],
                    JSON.stringify([
                        { name: 'WCash', type: 'ASSET' },
                        { name: 'WRevenue', type: 'INCOMING' },
                    ])
                );

                const wrappedInput = JSON.stringify({
                    items: [
                        {
                            date: '2025-08-01',
                            amount: '999',
                            description: 'Wrapped tx',
                            creditAccount: { name: 'WRevenue' },
                            debitAccount: { name: 'WCash' },
                        },
                    ],
                });

                const result = await runBkperWithStdin(
                    ['transaction', 'create', '-b', bookC],
                    wrappedInput
                );
                expect(result.exitCode).to.equal(0);
                const created = JSON.parse(result.stdout);
                expect(created).to.be.an('array').with.length(1);
                expect(created[0].description).to.equal('Wrapped tx');
            } finally {
                await deleteTestBook(bookC);
            }
        });
    });

    // ----------------------------------------------------------------
    // Edge cases
    // ----------------------------------------------------------------

    describe('edge cases', function () {
        it('should handle empty array stdin gracefully for accounts', async function () {
            const result = await runBkperWithStdin(['account', 'create', '-b', bookA], '[]');
            expect(result.exitCode).to.equal(0);
            const parsed = JSON.parse(result.stdout);
            expect(parsed).to.be.an('array').with.length(0);
        });

        it('should handle empty array stdin gracefully for groups', async function () {
            const result = await runBkperWithStdin(['group', 'create', '-b', bookA], '[]');
            expect(result.exitCode).to.equal(0);
            const parsed = JSON.parse(result.stdout);
            expect(parsed).to.be.an('array').with.length(0);
        });

        it('should handle empty array stdin gracefully for transactions', async function () {
            const result = await runBkperWithStdin(['transaction', 'create', '-b', bookA], '[]');
            expect(result.exitCode).to.equal(0);
            const parsed = JSON.parse(result.stdout);
            expect(parsed).to.be.an('array').with.length(0);
        });

        it('should handle { items: [] } wrapper with empty items', async function () {
            const result = await runBkperWithStdin(
                ['group', 'create', '-b', bookA],
                JSON.stringify({ items: [] })
            );
            expect(result.exitCode).to.equal(0);
            const parsed = JSON.parse(result.stdout);
            expect(parsed).to.be.an('array').with.length(0);
        });
    });

    // ----------------------------------------------------------------
    // Cross-resource workflow: full pipeline
    // ----------------------------------------------------------------

    describe('cross-resource workflow', function () {
        it('should pipe groups, accounts, and transactions across books', async function () {
            const sourceBook = await createTestBook(uniqueTestName('test-pipe-src'));
            const destBook = await createTestBook(uniqueTestName('test-pipe-dest'));

            try {
                // Step 1: Create groups in source
                const grpCreate = await runBkperWithStdin(
                    ['group', 'create', '-b', sourceBook],
                    JSON.stringify([{ name: 'XFlow Assets' }, { name: 'XFlow Income' }])
                );
                expect(grpCreate.exitCode).to.equal(0);

                // Step 2: Pipe groups from source to dest
                const grpList = await runBkper([
                    '--format',
                    'json',
                    'group',
                    'list',
                    '-b',
                    sourceBook,
                ]);
                expect(grpList.exitCode).to.equal(0);

                const grpPipe = await runBkperWithStdin(
                    ['group', 'create', '-b', destBook],
                    grpList.stdout
                );
                expect(grpPipe.exitCode).to.equal(0);

                // Step 3: Create accounts in source
                const acctCreate = await runBkperWithStdin(
                    ['account', 'create', '-b', sourceBook],
                    JSON.stringify([
                        { name: 'XFlow Cash', type: 'ASSET' },
                        { name: 'XFlow Sales', type: 'INCOMING' },
                    ])
                );
                expect(acctCreate.exitCode).to.equal(0);

                // Step 4: Pipe accounts from source to dest
                const acctList = await runBkper([
                    '--format',
                    'json',
                    'account',
                    'list',
                    '-b',
                    sourceBook,
                ]);
                expect(acctList.exitCode).to.equal(0);

                const acctPipe = await runBkperWithStdin(
                    ['account', 'create', '-b', destBook],
                    acctList.stdout
                );
                expect(acctPipe.exitCode).to.equal(0);

                // Step 5: Create transactions in source
                const txCreate = await runBkperWithStdin(
                    ['transaction', 'create', '-b', sourceBook],
                    JSON.stringify([
                        {
                            date: '2025-09-01',
                            amount: '1500',
                            description: 'XFlow sale',
                            creditAccount: { name: 'XFlow Sales' },
                            debitAccount: { name: 'XFlow Cash' },
                        },
                        {
                            date: '2025-09-02',
                            amount: '750',
                            description: 'XFlow refund',
                            creditAccount: { name: 'XFlow Cash' },
                            debitAccount: { name: 'XFlow Sales' },
                        },
                    ])
                );
                expect(txCreate.exitCode).to.equal(0);

                // Step 6: Pipe transactions from source to dest
                const txList = await runBkper([
                    '--format',
                    'json',
                    'transaction',
                    'list',
                    '-b',
                    sourceBook,
                    '-q',
                    'after:2025-08-31',
                ]);
                expect(txList.exitCode).to.equal(0);

                const txPipe = await runBkperWithStdin(
                    ['transaction', 'create', '-b', destBook],
                    txList.stdout
                );
                expect(txPipe.exitCode).to.equal(0);

                // Step 7: Verify everything in dest
                const destGroups = await runBkperJson<bkper.Group[]>([
                    'group',
                    'list',
                    '-b',
                    destBook,
                ]);
                const groupNames = destGroups.map(g => g.name);
                expect(groupNames).to.include('XFlow Assets');
                expect(groupNames).to.include('XFlow Income');

                const destAccounts = await runBkperJson<bkper.Account[]>([
                    'account',
                    'list',
                    '-b',
                    destBook,
                ]);
                const acctNames = destAccounts.map(a => a.name);
                expect(acctNames).to.include('XFlow Cash');
                expect(acctNames).to.include('XFlow Sales');

                const destTxResult = await runBkper([
                    '--format',
                    'json',
                    'transaction',
                    'list',
                    '-b',
                    destBook,
                    '-q',
                    'after:2025-08-31',
                ]);
                expect(destTxResult.exitCode).to.equal(0);
                const destTx = JSON.parse(destTxResult.stdout);
                const txDescriptions = destTx.map((t: bkper.Transaction) => t.description);
                expect(txDescriptions).to.include('XFlow sale');
                expect(txDescriptions).to.include('XFlow refund');
            } finally {
                await deleteTestBook(sourceBook);
                await deleteTestBook(destBook);
            }
        });
    });

    // ----------------------------------------------------------------
    // JSON output format consistency
    // ----------------------------------------------------------------

    describe('JSON output format consistency', function () {
        it('should output groups list as a flat JSON array', async function () {
            const result = await runBkper(['--format', 'json', 'group', 'list', '-b', bookA]);
            expect(result.exitCode).to.equal(0);
            const parsed = JSON.parse(result.stdout);
            expect(parsed).to.be.an('array');
        });

        it('should output accounts list as a flat JSON array', async function () {
            const result = await runBkper(['--format', 'json', 'account', 'list', '-b', bookA]);
            expect(result.exitCode).to.equal(0);
            const parsed = JSON.parse(result.stdout);
            expect(parsed).to.be.an('array');
        });

        it('should output transactions list as a flat JSON array', async function () {
            const result = await runBkper([
                '--format',
                'json',
                'transaction',
                'list',
                '-b',
                bookA,
                '-q',
                'after:2025-01-01',
            ]);
            expect(result.exitCode).to.equal(0);
            const parsed = JSON.parse(result.stdout);
            expect(parsed).to.be.an('array');
        });

        it('should output batch account create as a flat JSON array', async function () {
            const bookC = await createTestBook(uniqueTestName('test-fmt-acct'));
            try {
                const result = await runBkperWithStdin(
                    ['account', 'create', '-b', bookC],
                    JSON.stringify([{ name: 'Fmt Acct', type: 'ASSET' }])
                );
                expect(result.exitCode).to.equal(0);
                const parsed = JSON.parse(result.stdout);
                expect(parsed).to.be.an('array');
            } finally {
                await deleteTestBook(bookC);
            }
        });

        it('should output batch group create as a flat JSON array', async function () {
            const bookC = await createTestBook(uniqueTestName('test-fmt-grp'));
            try {
                const result = await runBkperWithStdin(
                    ['group', 'create', '-b', bookC],
                    JSON.stringify([{ name: 'Fmt Group' }])
                );
                expect(result.exitCode).to.equal(0);
                const parsed = JSON.parse(result.stdout);
                expect(parsed).to.be.an('array');
            } finally {
                await deleteTestBook(bookC);
            }
        });

        it('should output batch transaction create as a flat JSON array', async function () {
            const bookC = await createTestBook(uniqueTestName('test-fmt-tx'));
            try {
                await runBkperWithStdin(
                    ['account', 'create', '-b', bookC],
                    JSON.stringify([
                        { name: 'FmtCash', type: 'ASSET' },
                        { name: 'FmtRev', type: 'INCOMING' },
                    ])
                );

                const result = await runBkperWithStdin(
                    ['transaction', 'create', '-b', bookC],
                    JSON.stringify([
                        {
                            date: '2025-10-01',
                            amount: '100',
                            description: 'Fmt tx',
                            creditAccount: { name: 'FmtRev' },
                            debitAccount: { name: 'FmtCash' },
                        },
                    ])
                );
                expect(result.exitCode).to.equal(0);
                const parsed = JSON.parse(result.stdout);
                expect(parsed).to.be.an('array');
            } finally {
                await deleteTestBook(bookC);
            }
        });
    });
});
