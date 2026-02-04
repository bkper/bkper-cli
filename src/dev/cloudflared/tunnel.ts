import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import { bin } from './constants.js';

/**
 * Connection information from cloudflared.
 */
export interface Connection {
    id: string;
    ip: string;
    location: string;
}

/**
 * Events emitted by the Tunnel class.
 */
export interface TunnelEvents {
    /** Emitted when the tunnel URL is assigned. */
    url: (url: string) => void;
    /** Emitted when a connection is established. */
    connected: (connection: Connection) => void;
    /** Emitted when a connection is lost. */
    disconnected: (connection: Connection) => void;
    /** Emitted on stdout data. */
    stdout: (data: string) => void;
    /** Emitted on stderr data. */
    stderr: (data: string) => void;
    /** Emitted on error. */
    error: (error: Error) => void;
    /** Emitted when the process exits. */
    exit: (code: number | null, signal: NodeJS.Signals | null) => void;
}

/**
 * Regex patterns for parsing cloudflared output.
 */
const TRYCLOUDFLARE_URL_REGEX = /https:\/\/[^\s]+\.trycloudflare\.com/;
const CONNECTION_REGEX =
    /Connection ([a-f0-9-]+) registered with protocol: .* connIndex=\d+ ip=([\d.]+) location=(\w+)/;
const DISCONNECTION_REGEX = /Unregistered tunnel connection connIndex=\d+ ip=([\d.]+)/;

/**
 * Manages a cloudflared tunnel process.
 */
export class Tunnel extends EventEmitter {
    private _process: ChildProcess;
    private _url: string | null = null;

    constructor(args: string[]) {
        super();
        this._process = this.createProcess(args);
        this.setupEventHandlers();
    }

    /**
     * The underlying child process.
     */
    public get process(): ChildProcess {
        return this._process;
    }

    /**
     * The assigned tunnel URL, if available.
     */
    public get url(): string | null {
        return this._url;
    }

    private createProcess(args: string[]): ChildProcess {
        const child = spawn(bin, args, { stdio: ['ignore', 'pipe', 'pipe'] });

        child.on('error', error => this.emit('error', error));
        child.on('exit', (code, signal) => this.emit('exit', code, signal));

        child.stdout?.on('data', data => this.emit('stdout', data.toString()));
        child.stderr?.on('data', data => this.emit('stderr', data.toString()));

        return child;
    }

    private setupEventHandlers(): void {
        // cloudflared outputs to stderr primarily
        const handleOutput = (output: string): void => {
            // Check for URL assignment
            const urlMatch = output.match(TRYCLOUDFLARE_URL_REGEX);
            if (urlMatch && !this._url) {
                this._url = urlMatch[0];
                this.emit('url', this._url);
            }

            // Check for connection
            const connMatch = output.match(CONNECTION_REGEX);
            if (connMatch) {
                this.emit('connected', {
                    id: connMatch[1],
                    ip: connMatch[2],
                    location: connMatch[3],
                });
            }

            // Check for disconnection
            const disconnMatch = output.match(DISCONNECTION_REGEX);
            if (disconnMatch) {
                this.emit('disconnected', {
                    id: '',
                    ip: disconnMatch[1],
                    location: '',
                });
            }
        };

        this.on('stdout', handleOutput);
        this.on('stderr', handleOutput);
    }

    /**
     * Stops the tunnel process.
     */
    public stop(): boolean {
        return this._process.kill('SIGINT');
    }

    // Type-safe event emitter methods
    public on<E extends keyof TunnelEvents>(event: E, listener: TunnelEvents[E]): this {
        return super.on(event, listener);
    }

    public once<E extends keyof TunnelEvents>(event: E, listener: TunnelEvents[E]): this {
        return super.once(event, listener);
    }

    public off<E extends keyof TunnelEvents>(event: E, listener: TunnelEvents[E]): this {
        return super.off(event, listener);
    }

    public emit<E extends keyof TunnelEvents>(event: E, ...args: Parameters<TunnelEvents[E]>): boolean {
        return super.emit(event, ...args);
    }

    /**
     * Creates a Quick Tunnel (no Cloudflare account required).
     *
     * @param url - The local URL to tunnel (e.g., 'http://localhost:8080').
     *              If not provided, uses cloudflared's hello-world mode.
     * @returns A new Tunnel instance.
     */
    public static quick(url?: string): Tunnel {
        const args = ['tunnel'];
        if (url) {
            args.push('--url', url);
        } else {
            args.push('--hello-world');
        }
        return new Tunnel(args);
    }
}
