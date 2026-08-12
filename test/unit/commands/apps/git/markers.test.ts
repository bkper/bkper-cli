import {expect} from '../../../helpers/test-setup.js';
import fs from 'fs';
import path from 'path';
import {
    ensurePendingSourceMarker,
    isUuidV4,
    readSourceMarker,
    writeManagedSourceMarker,
} from '../../../../../src/commands/apps/git/markers.js';
import {getWorkingTreeStatus} from '../../../../../src/commands/apps/git/inspect.js';
import {ManagedGitError} from '../../../../../src/commands/apps/git/types.js';
import {ARTIFACTS_REMOTE, initRepo, makeTempDir} from './helpers.js';

describe('apps git markers', function () {
    let tempDir: string;

    beforeEach(function () {
        tempDir = makeTempDir();
        initRepo(tempDir);
    });

    afterEach(function () {
        fs.rmSync(tempDir, {recursive: true, force: true});
    });

    it('creates a pending UUID v4 marker and reuses its upload scope', function () {
        const first = ensurePendingSourceMarker(tempDir, 'all_refs');
        expect(first.state).to.equal('pending');
        expect(first.upload).to.equal('all_refs');
        expect(isUuidV4(first.activationId)).to.equal(true);

        const second = ensurePendingSourceMarker(tempDir, 'main');
        expect(second.activationId).to.equal(first.activationId);
        expect(second.upload).to.equal('all_refs');
        expect(readSourceMarker(tempDir)).to.deep.equal(first);
    });

    it('defaults legacy pending markers without an upload scope to main', function () {
        const markerPath = path.join(tempDir, '.bkper', 'source-marker.json');
        fs.mkdirSync(path.dirname(markerPath), {recursive: true});
        fs.writeFileSync(
            markerPath,
            JSON.stringify({
                version: 1,
                state: 'pending',
                activationId: '28fbf7de-9755-4bb3-a263-0227b2a2696b',
            }),
            'utf8'
        );

        expect(readSourceMarker(tempDir)).to.deep.equal({
            version: 1,
            state: 'pending',
            activationId: '28fbf7de-9755-4bb3-a263-0227b2a2696b',
            upload: 'main',
        });
    });

    it('keeps repository-local control markers out of managed clean-tree checks', async function () {
        ensurePendingSourceMarker(tempDir);
        expect(await getWorkingTreeStatus(tempDir)).to.deep.equal({
            clean: true,
            staged: [],
            modified: [],
            untracked: [],
        });
    });

    it('replaces pending with managed marker', function () {
        ensurePendingSourceMarker(tempDir);
        const managed = writeManagedSourceMarker(tempDir, 'demo-app', ARTIFACTS_REMOTE);
        expect(managed).to.deep.equal({
            version: 1,
            state: 'managed',
            appId: 'demo-app',
            remote: ARTIFACTS_REMOTE,
        });
        expect(readSourceMarker(tempDir)).to.deep.equal(managed);
    });

    it('rejects overwriting a managed marker with pending', function () {
        writeManagedSourceMarker(tempDir, 'demo-app', ARTIFACTS_REMOTE);
        expect(() => ensurePendingSourceMarker(tempDir)).to.throw(ManagedGitError);
    });

    it('rejects malformed markers', function () {
        const markerPath = path.join(tempDir, '.bkper', 'source-marker.json');
        fs.mkdirSync(path.dirname(markerPath), {recursive: true});
        fs.writeFileSync(markerPath, '{not-json', 'utf8');
        expect(() => readSourceMarker(tempDir)).to.throw(ManagedGitError);
    });
});
