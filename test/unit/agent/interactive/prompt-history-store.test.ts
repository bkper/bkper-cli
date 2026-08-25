import {mkdtempSync, readFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {expect} from '../../helpers/test-setup.js';
import {
    FilePromptHistory,
    searchPromptHistoryEntries,
    type PromptHistoryEntry,
} from '../../../../src/agent/interactive/prompt-history-store.js';

describe('prompt history store', function () {
    let directory: string;
    let historyPath: string;

    beforeEach(function () {
        directory = mkdtempSync(path.join(tmpdir(), 'bkper-prompt-history-'));
        historyPath = path.join(directory, 'history.jsonl');
    });

    afterEach(function () {
        rmSync(directory, {recursive: true, force: true});
    });

    it('persists submitted inputs without loading canonical sessions', function () {
        const history = new FilePromptHistory(historyPath);

        history.record('  first prompt  ', 'standard', 1);
        history.record('!git status', 'bash', 2);
        history.record('next session goal', 'handoff', 3);

        const restored = new FilePromptHistory(historyPath);
        expect(restored.getEntries()).to.deep.equal([
            {text: 'next session goal', kind: 'handoff', timestamp: 3},
            {text: '!git status', kind: 'bash', timestamp: 2},
            {text: 'first prompt', kind: 'standard', timestamp: 1},
        ]);
    });

    it('shows only the latest exact duplicate and can omit Bash inputs', function () {
        const entries: PromptHistoryEntry[] = [
            {text: 'deploy the worker', kind: 'standard', timestamp: 4},
            {text: '!bun test', kind: 'bash', timestamp: 3},
            {text: 'review handoff behavior', kind: 'handoff', timestamp: 2},
            {text: 'deploy the worker', kind: 'standard', timestamp: 1},
        ];

        expect(searchPromptHistoryEntries(entries, '', {includeBash: true})).to.deep.equal([
            entries[0],
            entries[1],
            entries[2],
        ]);
        expect(searchPromptHistoryEntries(entries, '', {includeBash: false})).to.deep.equal([
            entries[0],
            entries[2],
        ]);
    });

    it('uses fuzzy relevance with newest-first ties', function () {
        const entries: PromptHistoryEntry[] = [
            {text: 'finish handoff tests', kind: 'standard', timestamp: 3},
            {text: 'finish the handoff implementation', kind: 'standard', timestamp: 2},
            {text: 'unrelated prompt', kind: 'standard', timestamp: 1},
        ];

        expect(
            searchPromptHistoryEntries(entries, 'fin hand', {includeBash: true}).map(
                entry => entry.text
            )
        ).to.deep.equal(['finish handoff tests', 'finish the handoff implementation']);
    });

    it('rotates back to the newest bounded entries without a lock', function () {
        const history = new FilePromptHistory(historyPath, {
            maxEntries: 2,
            trimRecordCount: 4,
            maxFileBytes: 1024,
        });

        history.record('one', 'standard', 1);
        history.record('two', 'standard', 2);
        history.record('three', 'standard', 3);
        history.record('four', 'standard', 4);

        expect(history.getEntries().map(entry => entry.text)).to.deep.equal(['four', 'three']);
        expect(readFileSync(historyPath, 'utf8').trim().split('\n')).to.have.length(2);
        expect(
            new FilePromptHistory(historyPath, {
                maxEntries: 2,
                trimRecordCount: 4,
                maxFileBytes: 1024,
            })
                .getEntries()
                .map(entry => entry.text)
        ).to.deep.equal(['four', 'three']);
    });
});
