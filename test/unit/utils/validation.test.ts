import { expect } from '../helpers/test-setup.js';
import {
    ValidationError,
    validateRequiredOptions,
    throwIfErrors,
} from '../../../src/utils/validation.js';

describe('validation utils', function () {
    describe('ValidationError', function () {
        it('should carry the errors array', function () {
            const err = new ValidationError(['error one', 'error two']);
            expect(err.errors).to.deep.equal(['error one', 'error two']);
        });

        it('should format single error as plain message', function () {
            const err = new ValidationError(['only one problem']);
            expect(err.message).to.equal('only one problem');
        });

        it('should format multiple errors with header and bullets', function () {
            const err = new ValidationError(['missing --date', 'missing --amount']);
            expect(err.message).to.include('Validation failed:');
            expect(err.message).to.include('  - missing --date');
            expect(err.message).to.include('  - missing --amount');
        });

        it('should have name set to ValidationError', function () {
            const err = new ValidationError(['oops']);
            expect(err.name).to.equal('ValidationError');
        });

        it('should be an instance of Error', function () {
            const err = new ValidationError(['oops']);
            expect(err).to.be.instanceOf(Error);
        });
    });

    describe('validateRequiredOptions', function () {
        it('should return empty array when all options present', function () {
            const errors = validateRequiredOptions(
                { book: 'book-123', date: '2024-01-01', amount: '100' },
                [
                    { name: 'book', flag: '--book' },
                    { name: 'date', flag: '--date' },
                    { name: 'amount', flag: '--amount' },
                ]
            );
            expect(errors).to.have.length(0);
        });

        it('should return errors for all missing options', function () {
            const errors = validateRequiredOptions({ book: 'book-123' }, [
                { name: 'book', flag: '--book' },
                { name: 'date', flag: '--date' },
                { name: 'amount', flag: '--amount' },
            ]);
            expect(errors).to.have.length(2);
            expect(errors[0]).to.equal('Missing required option: --date');
            expect(errors[1]).to.equal('Missing required option: --amount');
        });

        it('should treat null as missing', function () {
            const errors = validateRequiredOptions({ book: null }, [
                { name: 'book', flag: '--book' },
            ]);
            expect(errors).to.have.length(1);
        });

        it('should accept falsy values that are not undefined/null', function () {
            const errors = validateRequiredOptions({ name: '', count: 0, flag: false }, [
                { name: 'name', flag: '--name' },
                { name: 'count', flag: '--count' },
                { name: 'flag', flag: '--flag' },
            ]);
            expect(errors).to.have.length(0);
        });

        it('should return errors for all missing when options object is empty', function () {
            const errors = validateRequiredOptions({}, [
                { name: 'book', flag: '-b, --book' },
                { name: 'query', flag: '-q, --query' },
            ]);
            expect(errors).to.have.length(2);
        });
    });

    describe('throwIfErrors', function () {
        it('should not throw when errors array is empty', function () {
            expect(() => throwIfErrors([])).to.not.throw();
        });

        it('should throw ValidationError when errors exist', function () {
            expect(() => throwIfErrors(['problem one', 'problem two'])).to.throw(ValidationError);
        });

        it('should include all errors in thrown ValidationError', function () {
            try {
                throwIfErrors(['a', 'b', 'c']);
                expect.fail('Should have thrown');
            } catch (err: unknown) {
                expect(err).to.be.instanceOf(ValidationError);
                expect((err as ValidationError).errors).to.deep.equal(['a', 'b', 'c']);
            }
        });
    });
});
