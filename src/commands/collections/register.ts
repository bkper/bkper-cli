import type { Command } from 'commander';
import { withAction } from '../action.js';
import { collectBook } from '../cli-helpers.js';
import { renderList, renderItem, renderNotice } from '../../render/index.js';
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
            withAction('listing collections', async () => {
                const result = await listCollectionsFormatted();
                renderList(result);
            })
        );

    collectionCommand
        .command('get <collectionId>')
        .description('Get a collection by ID')
        .action((collectionId: string) =>
            withAction('getting collection', async () => {
                const collection = await getCollection(collectionId);
                renderItem(collection.json());
            })()
        );

    collectionCommand
        .command('create')
        .description('Create a new collection')
        .option('--name <name>', 'Collection name')
        .action(options =>
            withAction('creating collection', async () => {
                throwIfErrors(validateRequiredOptions(options, [{ name: 'name', flag: '--name' }]));
                const collection = await createCollection({ name: options.name });
                renderItem(collection.json());
            })()
        );

    collectionCommand
        .command('update <collectionId>')
        .description('Update a collection')
        .option('--name <name>', 'Collection name')
        .action((collectionId: string, options) =>
            withAction('updating collection', async () => {
                const collection = await updateCollection(collectionId, {
                    name: options.name,
                });
                renderItem(collection.json());
            })()
        );

    collectionCommand
        .command('delete <collectionId>')
        .description('Delete a collection')
        .action((collectionId: string) =>
            withAction('deleting collection', async () => {
                await deleteCollection(collectionId);
                renderNotice(`Collection ${collectionId} deleted.`);
            })()
        );

    collectionCommand
        .command('add-book <collectionId>')
        .description('Add books to a collection')
        .option('-b, --book <bookId>', 'Book ID (repeatable)', collectBook)
        .action((collectionId: string, options) =>
            withAction('adding books to collection', async () => {
                throwIfErrors(validateRequiredOptions(options, [{ name: 'book', flag: '--book' }]));
                const books = await addBookToCollection(collectionId, options.book);
                renderList({ items: books.map(b => b.json()) });
            })()
        );

    collectionCommand
        .command('remove-book <collectionId>')
        .description('Remove books from a collection')
        .option('-b, --book <bookId>', 'Book ID (repeatable)', collectBook)
        .action((collectionId: string, options) =>
            withAction('removing books from collection', async () => {
                throwIfErrors(validateRequiredOptions(options, [{ name: 'book', flag: '--book' }]));
                const books = await removeBookFromCollection(collectionId, options.book);
                renderList({ items: books.map(b => b.json()) });
            })()
        );
}
