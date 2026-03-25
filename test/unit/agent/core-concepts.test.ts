import { expect } from '../helpers/test-setup.js';
import {
    CORE_CONCEPTS_CANONICAL_URL,
    renderCoreConceptsModule,
    validateCoreConceptsMarkdown,
} from '../../../src/agent/core-concepts.js';

describe('agent core concepts', function () {
    const validMarkdown = `# Core Concepts

## Accounts

## Transactions

## Books
`;

    it('should accept markdown with the required headings', function () {
        expect(() => validateCoreConceptsMarkdown(validMarkdown)).to.not.throw();
    });

    it('should reject empty markdown', function () {
        expect(() => validateCoreConceptsMarkdown('   ')).to.throw('Core concepts markdown is empty.');
    });

    it('should reject markdown without the main heading', function () {
        expect(() =>
            validateCoreConceptsMarkdown(`## Accounts

## Transactions

## Books
`)
        ).to.throw('Core concepts markdown is missing required heading: # Core Concepts');
    });

    it('should reject markdown without the accounts section', function () {
        expect(() =>
            validateCoreConceptsMarkdown(`# Core Concepts

## Transactions

## Books
`)
        ).to.throw('Core concepts markdown is missing required heading: ## Accounts');
    });

    it('should reject markdown without the transactions section', function () {
        expect(() =>
            validateCoreConceptsMarkdown(`# Core Concepts

## Accounts

## Books
`)
        ).to.throw('Core concepts markdown is missing required heading: ## Transactions');
    });

    it('should reject markdown without the books section', function () {
        expect(() =>
            validateCoreConceptsMarkdown(`# Core Concepts

## Accounts

## Transactions
`)
        ).to.throw('Core concepts markdown is missing required heading: ## Books');
    });

    it('should render a generated module with the canonical source url and markdown body', function () {
        const moduleSource = renderCoreConceptsModule(validMarkdown);

        expect(moduleSource).to.include('// AUTO-GENERATED FILE. DO NOT EDIT.');
        expect(moduleSource).to.include(`// Source: ${CORE_CONCEPTS_CANONICAL_URL}`);
        expect(moduleSource).to.include('export const CORE_CONCEPTS_MARKDOWN = ');
        expect(moduleSource).to.include(JSON.stringify(validMarkdown));
    });
});
