import { expect } from '../helpers/test-setup.js';
import { parsePropertyFlag } from '../../../src/utils/properties.js';

describe('properties utils', function () {
    describe('parsePropertyFlag', function () {
        it('should parse a simple key=value pair', function () {
            const [key, value] = parsePropertyFlag('code=1010');
            expect(key).to.equal('code');
            expect(value).to.equal('1010');
        });

        it('should parse a value containing spaces', function () {
            const [key, value] = parsePropertyFlag('address=Rua paulo afonso 1096');
            expect(key).to.equal('address');
            expect(value).to.equal('Rua paulo afonso 1096');
        });

        it('should parse a value containing equals signs', function () {
            const [key, value] = parsePropertyFlag('formula=a=b+c');
            expect(key).to.equal('formula');
            expect(value).to.equal('a=b+c');
        });

        it('should parse an empty value as deletion signal', function () {
            const [key, value] = parsePropertyFlag('code=');
            expect(key).to.equal('code');
            expect(value).to.equal('');
        });

        it('should throw on missing equals sign', function () {
            expect(() => parsePropertyFlag('invalidprop')).to.throw(
                'Invalid property format: "invalidprop". Expected key=value'
            );
        });

        it('should throw on empty key', function () {
            expect(() => parsePropertyFlag('=value')).to.throw(
                'Invalid property format: "=value". Key cannot be empty'
            );
        });

        it('should parse a value with special characters', function () {
            const [key, value] = parsePropertyFlag('phone=+55 31 9 9681 8639');
            expect(key).to.equal('phone');
            expect(value).to.equal('+55 31 9 9681 8639');
        });
    });
});
