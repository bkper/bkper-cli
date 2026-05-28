import { expect, setupTestEnvironment } from '../../helpers/test-setup.js';
import { Command } from 'commander';
import sinon from 'sinon';
import type { LogsResponse } from '../../../../src/commands/apps/types.js';
import {
    buildLogsQuery,
    logsApp,
    renderLogsResponse,
    requestAppLogs,
    resolveLogsOutputMode,
} from '../../../../src/commands/apps/logs.js';

describe('CLI - apps logs Command', function () {
    beforeEach(function () {
        setupTestEnvironment();
    });

    afterEach(function () {
        sinon.restore();
    });

    it('should build the default production query with last=100', function () {
        expect(buildLogsQuery({})).to.deep.equal({
            env: 'production',
            last: 100,
        });
    });

    it('should narrow the query when preview, level, and a single handler flag are selected', function () {
        expect(
            buildLogsQuery({
                preview: true,
                events: true,
                since: '5m',
                level: 'warn',
                statusCode: 500,
            })
        ).to.deep.equal({
            env: 'preview',
            handler: 'events',
            last: 100,
            level: 'warn',
            since: '5m',
            statusCode: 500,
        });

        expect(buildLogsQuery({ web: true, events: true })).to.deep.equal({
            env: 'production',
            last: 100,
        });
    });

    it('should resolve output mode from global format options and reject explicit table/csv', function () {
        const jsonCommand = new Command();
        jsonCommand.setOptionValueWithSource('format', 'json', 'cli');
        expect(resolveLogsOutputMode(jsonCommand)).to.equal('json');

        const defaultCommand = new Command();
        defaultCommand.setOptionValueWithSource('format', 'table', 'default');
        expect(resolveLogsOutputMode(defaultCommand)).to.equal('pretty');

        const csvCommand = new Command();
        csvCommand.setOptionValueWithSource('format', 'csv', 'cli');
        expect(() => resolveLogsOutputMode(csvCommand)).to.throw(
            'bkper app logs only supports default human-readable output or JSON.'
        );
    });

    it('should request logs for the app resolved from local config', async function () {
        const getStub = sinon.stub().resolves({
            data: {
                logs: [],
                meta: { last: 100, retentionDays: 15, warnings: [] },
            },
            error: undefined,
        });

        const response = await requestAppLogs(
            { preview: true, web: true, last: 25 },
            {
                loadAppConfig: () => ({ id: 'local-app' }) as bkper.App,
                getStoredOAuthToken: async () => 'token-123',
                createPlatformClient: () => ({
                    GET: getStub,
                }),
                handleError: error => {
                    throw new Error(String(error));
                },
                exit(code: number): never {
                    throw new Error(`process.exit(${code})`);
                },
            }
        );

        expect(response).to.deep.equal({
            logs: [],
            meta: { last: 100, retentionDays: 15, warnings: [] },
        });
        expect(getStub.calledOnce).to.be.true;
        expect(getStub.firstCall.args[0]).to.equal('/api/apps/{appId}/logs');
        expect(getStub.firstCall.args[1]).to.deep.equal({
            params: {
                path: { appId: 'local-app' },
                query: { env: 'preview', handler: 'web', last: 25 },
            },
        });
    });

    it('should request logs for an explicit app id without loading local config', async function () {
        const getStub = sinon.stub().resolves({
            data: {
                logs: [],
                meta: { last: 100, retentionDays: 15, warnings: [] },
            },
            error: undefined,
        });
        const loadAppConfigStub = sinon.stub().throws(new Error('should not load local config'));

        await requestAppLogs(
            { level: 'error' },
            {
                loadAppConfig: loadAppConfigStub,
                getStoredOAuthToken: async () => 'token-123',
                createPlatformClient: () => ({
                    GET: getStub,
                }),
                handleError: error => {
                    throw new Error(String(error));
                },
                exit(code: number): never {
                    throw new Error(`process.exit(${code})`);
                },
            },
            'remote-app'
        );

        expect(loadAppConfigStub.called).to.equal(false);
        expect(getStub.firstCall.args[1]).to.deep.equal({
            params: {
                path: { appId: 'remote-app' },
                query: { env: 'production', last: 100, level: 'error' },
            },
        });
    });

    it('should render pretty output oldest to newest', function () {
        const response: LogsResponse = {
            logs: [
                {
                    timestamp: '2026-04-29T12:02:00.000Z',
                    environment: 'production',
                    handler: 'web',
                    outcome: 'ok',
                    requestMethod: 'GET',
                    requestUrl: 'https://app.bkper.app/',
                    level: 'warn',
                    statusCode: 200,
                    entries: [{ level: 'warn', message: 'second' }],
                },
                {
                    timestamp: '2026-04-29T12:01:00.000Z',
                    environment: 'production',
                    handler: 'web',
                    outcome: 'ok',
                    requestMethod: 'GET',
                    requestUrl: 'https://app.bkper.app/',
                    level: 'info',
                    statusCode: 200,
                    entries: [{ level: 'info', message: 'first' }],
                },
            ],
            meta: { last: 100, retentionDays: 15, warnings: [] },
        };

        const rendered = renderLogsResponse(response, 'pretty');

        expect(rendered.indexOf('2026-04-29T12:01:00.000Z')).to.be.lessThan(
            rendered.indexOf('2026-04-29T12:02:00.000Z')
        );
        expect(rendered).to.include('  info: first');
        expect(rendered).to.include('  warn: second');
    });

    it('should render error entries with structured exception details', function () {
        const response: LogsResponse = {
            logs: [
                {
                    timestamp: '2026-04-29T12:02:00.000Z',
                    environment: 'production',
                    handler: 'events',
                    level: 'error',
                    outcome: 'exception',
                    requestMethod: 'POST',
                    requestUrl: 'https://app.bkper.app/events',
                    statusCode: 500,
                    entries: [
                        { level: 'info', message: 'received event' },
                        {
                            level: 'error',
                            name: 'Error',
                            message: 'boom',
                            stack: 'Error: boom\n    at handler',
                        },
                    ],
                },
            ],
            meta: { last: 100, retentionDays: 15, warnings: [] },
        };

        const rendered = renderLogsResponse(response, 'pretty');

        expect(rendered).to.include('  info: received event');
        expect(rendered).to.include('  error: Error: boom');
        expect(rendered).to.include('    Error: boom');
    });

    it('should render the full API response in json mode', function () {
        const response: LogsResponse = {
            logs: [],
            meta: {
                last: 50,
                retentionDays: 15,
                warnings: ['since was clamped to the 15-day retention window'],
            },
        };

        const rendered = renderLogsResponse(response, 'json');
        expect(JSON.parse(rendered)).to.deep.equal(response);
    });

    it('should reject unsupported output format before making an API request', async function () {
        const command = new Command();
        command.setOptionValueWithSource('format', 'csv', 'cli');

        const createPlatformClient = sinon.stub();

        try {
            await logsApp(
                {},
                {
                    createPlatformClient,
                },
                command
            );
            expect.fail('Expected logsApp to throw');
        } catch (error) {
            expect((error as Error).message).to.equal(
                'bkper app logs only supports default human-readable output or JSON. Use --json or --format json.'
            );
        }

        expect(createPlatformClient.called).to.equal(false);
    });
});
