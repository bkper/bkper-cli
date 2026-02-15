import type { Command } from 'commander';
import { withAction } from '../action.js';
import { collectBook } from '../cli-helpers.js';
import { renderListResult, renderItem } from '../../render/index.js';
import { validateRequiredOptions, throwIfErrors } from '../../utils/validation.js';
import {
    listCollectionsFormatted,
    getCollection,
    createCollection,
    updateCollection,
    deleteCollection,
    addBookToCollection,
    removeBookFromCollection,
} from './index.js';

export function registerCollectionCommands(program: Command): void {
    const collectionCommand = program.command('collection').description('Manage Collections');

    collectionCommand
        .command('list')
        .description('List all collections')
        .action(
            withAction('listing collections', async format => {
                const result = await listCollectionsFormatted(format);
                renderListResult(result, format);
            })
        );

    collectionCommand
        .command('get <collectionId>')
        .description('Get a collection by ID')
        .action((collectionId: string) =>
            withAction('getting collection', async format => {
                const collection = await getCollection(collectionId);
                renderItem(collection.json(), format);
            })()
        );

    collectionCommand
        .command('create')
        .description('Create a new collection')
        .option('--name <name>', 'Collection name')
        .action(options =>
            withAction('creating collection', async format => {
                throwIfErrors(validateRequiredOptions(options, [{ name: 'name', flag: '--name' }]));
                const collection = await createCollection({ name: options.name });
                renderItem(collection.json(), format);
            })()
        );

    collectionCommand
        .command('update <collectionId>')
        .description('Update a collection')
        .option('--name <name>', 'Collection name')
        .action((collectionId: string, options) =>
            withAction('updating collection', async format => {
                const collection = await updateCollection(collectionId, {
                    name: options.name,
                });
                renderItem(collection.json(), format);
            })()
        );

    collectionCommand
        .command('delete <collectionId>')
        .description('Delete a collection')
        .action((collectionId: string) =>
            withAction('deleting collection', async () => {
                await deleteCollection(collectionId);
                console.log(`Collection ${collectionId} deleted.`);
            })()
        );

    collectionCommand
        .command('add-book <collectionId>')
        .description('Add books to a collection')
        .option('-b, --book <bookId>', 'Book ID (repeatable)', collectBook)
        .action((collectionId: string, options) =>
            withAction('adding books to collection', async format => {
                throwIfErrors(validateRequiredOptions(options, [{ name: 'book', flag: '--book' }]));
                const books = await addBookToCollection(collectionId, options.book);
                if (format === 'json' || format === 'csv') {
                    console.log(
                        JSON.stringify(
                            books.map(b => b.json()),
                            null,
                            2
                        )
                    );
                } else {
                    console.log(
                        `Added ${options.book.length} book(s) to collection ${collectionId}.`
                    );
                }
            })()
        );

    collectionCommand
        .command('remove-book <collectionId>')
        .description('Remove books from a collection')
        .option('-b, --book <bookId>', 'Book ID (repeatable)', collectBook)
        .action((collectionId: string, options) =>
            withAction('removing books from collection', async format => {
                throwIfErrors(validateRequiredOptions(options, [{ name: 'book', flag: '--book' }]));
                const books = await removeBookFromCollection(collectionId, options.book);
                if (format === 'json' || format === 'csv') {
                    console.log(
                        JSON.stringify(
                            books.map(b => b.json()),
                            null,
                            2
                        )
                    );
                } else {
                    console.log(
                        `Removed ${options.book.length} book(s) from collection ${collectionId}.`
                    );
                }
            })()
        );
}
