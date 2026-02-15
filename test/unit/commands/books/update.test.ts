import { expect, setupTestEnvironment } from '../../helpers/test-setup.js';
import { setMockBkper } from '../../helpers/mock-factory.js';
import { ValidationError } from '../../../../src/utils/validation.js';

// Import after mock setup
const { updateBook } = await import('../../../../src/commands/books/update.js');

describe('CLI - book update Command', function () {
    let mockBook: any;
    let updateCalled: boolean;

    beforeEach(function () {
        setupTestEnvironment();
        updateCalled = false;

        mockBook = {
            setName: function (n: string) {
                this._name = n;
                return this;
            },
            setFractionDigits: function (d: number) {
                this._fractionDigits = d;
                return this;
            },
            setDatePattern: function (p: string) {
                this._datePattern = p;
                return this;
            },
            setDecimalSeparator: function (s: string) {
                this._decimalSeparator = s;
                return this;
            },
            setTimeZone: function (tz: string) {
                this._timeZone = tz;
                return this;
            },
            setLockDate: function (d: string) {
                this._lockDate = d;
                return this;
            },
            setClosingDate: function (d: string) {
                this._closingDate = d;
                return this;
            },
            setPeriod: function (p: string) {
                this._period = p;
                return this;
            },
            setProperty: function (key: string, value: string) {
                this._properties = this._properties || {};
                this._properties[key] = value;
                return this;
            },
            deleteProperty: function (key: string) {
                this._deletedProperties = this._deletedProperties || [];
                this._deletedProperties.push(key);
                return this;
            },
            update: async function () {
                updateCalled = true;
                return this;
            },
            json: () => ({ id: 'book-123', name: 'My Ledger' }),
        };

        setMockBkper({
            setConfig: () => {},
            getBook: async () => mockBook,
        });
    });

    it('should update book name', async function () {
        await updateBook('book-123', { name: 'New Name' });

        expect(updateCalled).to.be.true;
        expect(mockBook._name).to.equal('New Name');
    });

    it('should update fraction digits', async function () {
        await updateBook('book-123', { fractionDigits: 4 });

        expect(updateCalled).to.be.true;
        expect(mockBook._fractionDigits).to.equal(4);
    });

    it('should update date pattern', async function () {
        await updateBook('book-123', { datePattern: 'dd/MM/yyyy' });

        expect(updateCalled).to.be.true;
        expect(mockBook._datePattern).to.equal('dd/MM/yyyy');
    });

    it('should update decimal separator', async function () {
        await updateBook('book-123', { decimalSeparator: 'COMMA' });

        expect(updateCalled).to.be.true;
        expect(mockBook._decimalSeparator).to.equal('COMMA');
    });

    it('should update time zone', async function () {
        await updateBook('book-123', { timeZone: 'America/Sao_Paulo' });

        expect(updateCalled).to.be.true;
        expect(mockBook._timeZone).to.equal('America/Sao_Paulo');
    });

    it('should update lock date', async function () {
        await updateBook('book-123', { lockDate: '2024-01-01' });

        expect(updateCalled).to.be.true;
        expect(mockBook._lockDate).to.equal('2024-01-01');
    });

    it('should update closing date', async function () {
        await updateBook('book-123', { closingDate: '2024-12-31' });

        expect(updateCalled).to.be.true;
        expect(mockBook._closingDate).to.equal('2024-12-31');
    });

    it('should update period', async function () {
        await updateBook('book-123', { period: 'QUARTER' });

        expect(updateCalled).to.be.true;
        expect(mockBook._period).to.equal('QUARTER');
    });

    it('should set properties', async function () {
        await updateBook('book-123', {
            property: ['region=LATAM'],
        });

        expect(updateCalled).to.be.true;
        expect(mockBook._properties).to.deep.equal({ region: 'LATAM' });
    });

    it('should delete properties with empty value', async function () {
        await updateBook('book-123', {
            property: ['old_key='],
        });

        expect(updateCalled).to.be.true;
        expect(mockBook._deletedProperties).to.include('old_key');
    });

    it('should only update provided fields', async function () {
        await updateBook('book-123', { name: 'Only this' });

        expect(updateCalled).to.be.true;
        expect(mockBook._name).to.equal('Only this');
        expect(mockBook._fractionDigits).to.be.undefined;
        expect(mockBook._datePattern).to.be.undefined;
        expect(mockBook._period).to.be.undefined;
    });

    it('should throw ValidationError for invalid property format', async function () {
        try {
            await updateBook('book-123', {
                property: ['noequalssign'],
            });
            expect.fail('Should have thrown');
        } catch (err: unknown) {
            expect(err).to.be.instanceOf(ValidationError);
            expect((err as ValidationError).errors[0]).to.include('Invalid property format');
        }
    });

    it('should report multiple invalid properties at once', async function () {
        try {
            await updateBook('book-123', {
                property: ['bad1', 'bad2'],
            });
            expect.fail('Should have thrown');
        } catch (err: unknown) {
            expect(err).to.be.instanceOf(ValidationError);
            const ve = err as ValidationError;
            expect(ve.errors).to.have.length(2);
            expect(ve.errors[0]).to.include('Invalid property format');
            expect(ve.errors[1]).to.include('Invalid property format');
        }
    });
});
