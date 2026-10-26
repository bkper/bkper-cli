import {mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {homedir, tmpdir} from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {expect} from '../../helpers/test-setup.js';
import {
    buildInitialPrompt,
    resolveFileArgumentPath,
} from '../../../../src/agent/interactive/initial-prompt.js';
import {AgentStartupError} from '../../../../src/agent/startup-error.js';

// A 1x1 transparent PNG.
const PNG_BASE64 =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

/** A 1x1 24-bit BMP; an unknown compression method still looks like a BMP but cannot decode. */
function createBmp(compression = 0): Buffer {
    const bmp = Buffer.alloc(58);
    bmp.write('BM', 0, 'ascii');
    bmp.writeUInt32LE(58, 2); // file size
    bmp.writeUInt32LE(54, 10); // pixel data offset
    bmp.writeUInt32LE(40, 14); // DIB header size
    bmp.writeInt32LE(1, 18); // width
    bmp.writeInt32LE(1, 22); // height
    bmp.writeUInt16LE(1, 26); // planes
    bmp.writeUInt16LE(24, 28); // bits per pixel
    bmp.writeUInt32LE(compression, 30);
    bmp.writeUInt32LE(4, 34); // pixel data size, one row padded to 4 bytes
    bmp.writeUInt8(255, 56); // the pixel is red (stored as BGR)
    return bmp;
}

async function buildError(fileArgs: string[], cwd: string): Promise<unknown> {
    try {
        await buildInitialPrompt([], fileArgs, cwd);
    } catch (error) {
        return error;
    }
    return undefined;
}

describe('buildInitialPrompt', function () {
    let dir: string;

    beforeEach(function () {
        dir = mkdtempSync(path.join(tmpdir(), 'bkper-initial-prompt-'));
    });

    afterEach(function () {
        rmSync(dir, {recursive: true, force: true});
    });

    it('has no initial prompt without messages or files', async function () {
        expect(await buildInitialPrompt()).to.deep.equal({});
    });

    it('sends the first message first and the rest as later turns', async function () {
        expect(await buildInitialPrompt(['first', 'second', 'third'])).to.deep.equal({
            initialMessage: 'first',
            initialMessages: ['second', 'third'],
        });
    });

    it('puts text files, resolved against cwd, before the first message', async function () {
        writeFileSync(path.join(dir, 'brief.md'), '\uFEFFReview the diff');
        writeFileSync(path.join(dir, 'empty.md'), '');

        const prompt = await buildInitialPrompt(['Task'], ['brief.md', 'empty.md'], dir);

        expect(prompt).to.deep.equal({
            initialMessage: `<file name="${path.join(
                dir,
                'brief.md'
            )}">\nReview the diff\n</file>\nTask`,
        });
    });

    it('attaches image files', async function () {
        const image = path.join(dir, 'pixel.png');
        writeFileSync(image, Buffer.from(PNG_BASE64, 'base64'));

        const prompt = await buildInitialPrompt([], [image], dir);

        expect(prompt).to.deep.equal({
            initialMessage: `<file name="${image}"></file>\n`,
            initialImages: [{type: 'image', mimeType: 'image/png', data: PNG_BASE64}],
        });
    });

    it('converts other image formats to PNG and notes it', async function () {
        const image = path.join(dir, 'pixel.bmp');
        writeFileSync(image, createBmp());

        const prompt = await buildInitialPrompt([], [image], dir);

        expect(prompt.initialMessage).to.equal(
            `<file name="${image}">[Image converted from image/bmp to image/png.]</file>\n`
        );
        expect(prompt.initialImages).to.have.length(1);
        expect(prompt.initialImages?.[0].mimeType).to.equal('image/png');
    });

    it('omits an image it cannot convert and notes it', async function () {
        const image = path.join(dir, 'broken.bmp');
        writeFileSync(image, createBmp(99));

        const prompt = await buildInitialPrompt([], [image], dir);

        expect(prompt).to.deep.equal({
            initialMessage: `<file name="${image}">[Image omitted: could not be converted to a supported inline image format.]</file>\n`,
        });
    });

    it('fails on a missing file with a startup error', async function () {
        const missing = path.join(dir, 'missing.md');

        const error = await buildError([missing], dir);

        expect(error).to.be.instanceOf(AgentStartupError);
        expect((error as Error).message).to.equal(`File not found: ${missing}`);
    });
});

describe('resolveFileArgumentPath', function () {
    let dir: string;

    beforeEach(function () {
        dir = mkdtempSync(path.join(tmpdir(), 'bkper-file-arg-'));
    });

    afterEach(function () {
        rmSync(dir, {recursive: true, force: true});
    });

    function createFile(name: string): string {
        const file = path.join(dir, name);
        writeFileSync(file, 'content');
        return file;
    }

    it('expands ~ to the home directory', function () {
        expect(resolveFileArgumentPath('~/notes.md', dir)).to.equal(
            path.join(homedir(), 'notes.md')
        );
        expect(resolveFileArgumentPath('~', dir)).to.equal(homedir());
    });

    it('strips a leading @', function () {
        const file = createFile('brief.md');

        expect(resolveFileArgumentPath('@brief.md', dir)).to.equal(file);
    });

    it('reads Unicode spaces as plain spaces', function () {
        const file = createFile('my brief.md');

        expect(resolveFileArgumentPath('my\u00A0brief.md', dir)).to.equal(file);
    });

    it('accepts file:// URLs', function () {
        const file = createFile('brief.md');

        expect(resolveFileArgumentPath(pathToFileURL(file).href, dir)).to.equal(file);
    });

    it('finds macOS screenshots named with a narrow no-break space before AM/PM', function () {
        const file = createFile('Screenshot 2026-10-26 at 12.39.05\u202FPM.png');

        expect(resolveFileArgumentPath('Screenshot 2026-10-26 at 12.39.05 PM.png', dir)).to.equal(
            file
        );
    });

    it('finds files whose names macOS stores in NFD form', function () {
        const file = createFile('re\u0301sume\u0301.md');

        expect(resolveFileArgumentPath('r\u00e9sum\u00e9.md', dir)).to.equal(file);
    });

    it('finds files named with curly apostrophes', function () {
        const file = createFile('Capture d\u2019e\u0301cran.png');

        expect(resolveFileArgumentPath("Capture d'\u00e9cran.png", dir)).to.equal(file);
    });

    it('converts Windows shell drive paths on Windows', function () {
        expect(resolveFileArgumentPath('/c/Users/me/brief.md', dir, 'win32')).to.equal(
            path.resolve(dir, 'C:\\Users\\me\\brief.md')
        );
        expect(resolveFileArgumentPath('/c/Users/me/brief.md', dir, 'linux')).to.equal(
            '/c/Users/me/brief.md'
        );
    });

    it('returns the plain resolved path when no variant exists', function () {
        expect(resolveFileArgumentPath('missing.md', dir)).to.equal(path.join(dir, 'missing.md'));
    });
});
