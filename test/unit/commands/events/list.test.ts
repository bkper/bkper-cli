import { expect, setupTestEnvironment } from '../../helpers/test-setup.js';
import { setMockBkper } from '../../helpers/mock-factory.js';

const { DEFAULT_EVENT_LIST_LIMIT, listEvents, listEventsFormatted } = await import(
    '../../../../src/commands/events/list.js'
);

describe('CLI - event list Command', function () {
    let mockBook: any;

    beforeEach(function () {
        setupTestEnvironment();
    });

    it('should list one page of events with default limit 50', async function () {
        let capturedOptions: Record<string, unknown> | undefined;
        const mockEvents = [
            {
                getId: () => 'evt-1',
                json: () => ({
                    id: 'evt-1',
                    type: 'TRANSACTION_POSTED',
                    botResponses: [{ agentId: 'tax-bot', type: 'INFO', message: 'ok' }],
                }),
            },
        ];

        mockBook = {
            listEvents: async (options: Record<string, unknown>) => {
                capturedOptions = options;
                return {
                    getItems: () => mockEvents,
                    getCursor: () => 'next-cursor',
                };
            },
        };

        setMockBkper({
            setConfig: () => {},
            getBook: async () => mockBook,
        });

        const result = await listEvents('book-123', {});

        expect(capturedOptions).to.deep.equal({ limit: DEFAULT_EVENT_LIST_LIMIT });
        expect(DEFAULT_EVENT_LIST_LIMIT).to.equal(50);
        expect(result.items).to.equal(mockEvents);
        expect(result.cursor).to.equal('next-cursor');
    });

    it('should pass filters and pagination options to book.listEvents', async function () {
        let capturedOptions: Record<string, unknown> | undefined;

        mockBook = {
            listEvents: async (options: Record<string, unknown>) => {
                capturedOptions = options;
                return {
                    getItems: () => [],
                    getCursor: () => undefined,
                };
            },
        };

        setMockBkper({
            setConfig: () => {},
            getBook: async () => mockBook,
        });

        await listEvents('book-123', {
            afterDate: '2026-01-01T00:00:00Z',
            beforeDate: '2026-02-01T00:00:00Z',
            resourceId: 'tx-1',
            onError: true,
            type: 'TRANSACTION_POSTED' as any,
            limit: 50,
            cursor: 'page-2',
        });

        expect(capturedOptions).to.deep.equal({
            afterDate: '2026-01-01T00:00:00Z',
            beforeDate: '2026-02-01T00:00:00Z',
            resourceId: 'tx-1',
            onError: true,
            type: 'TRANSACTION_POSTED',
            limit: 50,
            cursor: 'page-2',
        });
    });

    it('should omit onError when not filtering errors', async function () {
        let capturedOptions: Record<string, unknown> | undefined;

        mockBook = {
            listEvents: async (options: Record<string, unknown>) => {
                capturedOptions = options;
                return {
                    getItems: () => [],
                    getCursor: () => undefined,
                };
            },
        };

        setMockBkper({
            setConfig: () => {},
            getBook: async () => mockBook,
        });

        await listEvents('book-123', { limit: 10 });

        expect(capturedOptions).to.deep.equal({ limit: 10 });
        expect(capturedOptions).to.not.have.property('onError');
    });

    it('should return full event JSON including botResponses', async function () {
        const eventJson = {
            id: 'evt-1',
            type: 'TRANSACTION_POSTED',
            resource: 'tx-1',
            botResponses: [
                { agentId: 'tax-bot', type: 'ERROR', message: 'timeout' },
                { agentId: 'exchange-bot', type: 'INFO', message: 'converted' },
            ],
        };

        mockBook = {
            listEvents: async () => ({
                getItems: () => [
                    {
                        getId: () => 'evt-1',
                        json: () => eventJson,
                    },
                ],
                getCursor: () => 'next-cursor',
            }),
        };

        setMockBkper({
            setConfig: () => {},
            getBook: async () => mockBook,
        });

        const result = await listEventsFormatted('book-123', {}, 'json');

        expect(result).to.deep.equal({
            kind: 'json',
            items: [eventJson],
            cursor: 'next-cursor',
        });
    });

    it('should build a summary matrix and next-page footer with active filters', async function () {
        mockBook = {
            listEvents: async () => ({
                getItems: () => [
                    {
                        getId: () => 'evt-1',
                        json: () => ({
                            id: 'evt-1',
                            type: 'TRANSACTION_POSTED',
                            createdOn: '2026-01-15T12:00:00Z',
                            resource: 'tx-1',
                            user: { email: 'user@example.com' },
                            agent: { id: 'cli', name: 'Bkper CLI' },
                            botResponses: [
                                { agentId: 'tax-bot', type: 'ERROR', message: 'rate limit exceeded' },
                                { agentId: 'exchange-bot', type: 'INFO', message: 'ok' },
                            ],
                        }),
                    },
                ],
                getCursor: () => 'next-cursor',
            }),
        };

        setMockBkper({
            setConfig: () => {},
            getBook: async () => mockBook,
        });

        const result = await listEventsFormatted(
            'book-123',
            {
                onError: true,
                type: 'TRANSACTION_POSTED' as any,
                limit: 50,
            },
            'table'
        );

        expect(result.kind).to.equal('matrix');
        if (result.kind !== 'matrix') {
            throw new Error('Expected matrix list result');
        }

        expect(result.matrix[0]).to.deep.equal([
            'ID',
            'Type',
            'Created',
            'Resource',
            'User',
            'Agent',
            'Responses',
            'Errors',
            'Preview',
        ]);
        expect(result.matrix[1]).to.deep.equal([
            'evt-1',
            'TRANSACTION_POSTED',
            '2026-01-15T12:00:00Z',
            'tx-1',
            'user@example.com',
            'Bkper CLI',
            2,
            1,
            'rate limit exceeded',
        ]);
        expect(result.footer).to.contain('Next cursor: next-cursor');
        expect(result.footer).to.contain(
            "Next page: bkper event list -b 'book-123' --error --type 'TRANSACTION_POSTED' --limit 50 --cursor 'next-cursor'"
        );
    });
});
