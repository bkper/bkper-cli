import { describe, it, before, after } from 'mocha';
import fs from 'fs';
import os from 'os';
import path from 'path';
import getPort from 'get-port';
import { startCli, stopProcess, waitForUrl } from './helpers/cli-helpers.js';
import { expect } from '../helpers.js';
import type { ChildProcess } from 'child_process';

const CLI_PATH = path.resolve(import.meta.dirname, '../../../lib/cli.js');
const REPO_ROOT = path.resolve(import.meta.dirname, '../../..');

describe('Integration: app dev', function () {
    let appDir: string;
    let devProcess: ChildProcess | null = null;
    let devPort: number;
    let devOutput: string[] = [];

    before(function () {
        if (!fs.existsSync(CLI_PATH)) {
            console.log(`\n  Skipping: CLI build not found at ${CLI_PATH}`);
            console.log('   Build it with: bun run build\n');
            return this.skip();
        }

        appDir = createDevTestApp();
    });

    after(async function () {
        this.timeout(60000);

        if (devProcess) {
            await stopProcess(devProcess, 10000);
            devProcess = null;
        }

        if (appDir && fs.existsSync(appDir)) {
            fs.rmSync(appDir, { recursive: true, force: true });
        }
    });

    it('should start the dev server and respond on the single Worker port', async function () {
        this.timeout(120000);

        await startDevServer();
        await waitForDevUrl('/health', 60000);

        const eventResponse = await fetch(`http://localhost:${devPort}/events`, {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                Authorization: 'Bearer should-be-stripped',
                'bkper-oauth-token': 'should-be-stripped',
                'bkper-agent-id': 'should-be-stripped',
            },
            body: JSON.stringify({ type: 'UNKNOWN_EVENT' }),
        });
        const body = await eventResponse.json();

        expect(eventResponse.status).to.equal(200);
        expect(body).to.deep.equal({
            result: false,
            authorization: null,
            bkperOauthToken: null,
            bkperAgentId: null,
        });
    });

    it('should handle graceful shutdown on SIGINT', async function () {
        this.timeout(30000);

        if (!devProcess) {
            await startDevServer();
            await waitForDevUrl('/health', 60000);
        }

        const processToStop = devProcess;
        if (!processToStop) {
            throw new Error('Dev process did not start');
        }

        await stopProcess(processToStop, 15000);
        devProcess = null;
    });

    async function startDevServer(): Promise<void> {
        devPort = await getPort();
        devOutput = [];
        devProcess = startCli(['app', 'dev', '--server-port', String(devPort)], appDir);
        collectProcessOutput(devProcess, devOutput);
    }

    async function waitForDevUrl(pathname: string, timeoutMs: number): Promise<void> {
        if (!devProcess) {
            throw new Error('Dev process is not running');
        }

        await Promise.race([
            waitForUrl(`http://localhost:${devPort}${pathname}`, timeoutMs),
            rejectOnEarlyExit(devProcess, devOutput),
        ]);
    }
});

function createDevTestApp(): string {
    const appDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bkper-app-dev-test-'));
    const serverSrcDir = path.join(appDir, 'server/src');
    const nodeModulesDir = path.join(appDir, 'node_modules');

    fs.mkdirSync(serverSrcDir, { recursive: true });
    fs.mkdirSync(nodeModulesDir, { recursive: true });

    fs.writeFileSync(
        path.join(appDir, 'package.json'),
        JSON.stringify(
            {
                name: 'app-dev-integration',
                private: true,
                devDependencies: { miniflare: '^4' },
            },
            null,
            2
        ) + '\n'
    );

    fs.writeFileSync(
        path.join(appDir, 'bkper.yaml'),
        `id: app-dev-integration
name: App Dev Integration
deployment:
  server: server/src/index.ts
`
    );

    fs.writeFileSync(
        path.join(serverSrcDir, 'index.ts'),
        `export default {
    async fetch(request: Request): Promise<Response> {
        const pathname = new URL(request.url).pathname;

        if (pathname === '/health') {
            return Response.json({ status: 'ok' });
        }

        if (pathname === '/events' && request.method === 'POST') {
            await request.json();
            return Response.json({
                result: false,
                authorization: request.headers.get('Authorization'),
                bkperOauthToken: request.headers.get('bkper-oauth-token'),
                bkperAgentId: request.headers.get('bkper-agent-id'),
            });
        }

        return new Response('Not found', { status: 404 });
    },
};
`
    );

    const miniflareSource = path.join(REPO_ROOT, 'node_modules/miniflare');
    const miniflareTarget = path.join(nodeModulesDir, 'miniflare');
    fs.symlinkSync(miniflareSource, miniflareTarget, 'dir');

    return appDir;
}

function collectProcessOutput(child: ChildProcess, output: string[]): void {
    child.stdout?.on('data', chunk => output.push(chunk.toString()));
    child.stderr?.on('data', chunk => output.push(chunk.toString()));
}

function rejectOnEarlyExit(child: ChildProcess, output: string[]): Promise<never> {
    return new Promise((_resolve, reject) => {
        child.once('exit', code => {
            reject(
                new Error(
                    `bkper app dev exited before the server was ready (code ${code}).\n${output.join('')}`
                )
            );
        });
    });
}
