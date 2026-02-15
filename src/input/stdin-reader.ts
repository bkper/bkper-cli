/**
 * Reads all content from stdin if piped input is available.
 * Returns null if stdin is a TTY (no piped input) or if the input is empty.
 *
 * @returns The trimmed stdin content, or null if no input is available
 */
export async function readStdin(): Promise<string | null> {
    if (process.stdin.isTTY) {
        return null;
    }

    return new Promise((resolve, reject) => {
        const chunks: string[] = [];
        process.stdin.setEncoding('utf8');

        process.stdin.on('data', (chunk: string) => {
            chunks.push(chunk);
        });

        process.stdin.on('end', () => {
            const content = chunks.join('').trim();
            resolve(content.length > 0 ? content : null);
        });

        process.stdin.on('error', (err: Error) => {
            reject(err);
        });
    });
}
