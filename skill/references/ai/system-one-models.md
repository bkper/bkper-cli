# System One Models

A System One model answers typed questions about one input, called the state, such as a bank line or a supplier email. It writes no text. Each answer comes back in a shape you set in advance, with a probability or confidence your code can compare.

Every question has a type, and the types come in two families:

- **Decision questions judge.** Is this bank line already recorded? Which Account fits it?
- **Extraction questions read values.** What are the invoice number, the total, and the issue date? They also estimate uncertain numbers, such as days until an invoice is paid.

Each model answers the question types it lists: Jev and Clef answer decision questions, and Clairic answers extraction questions. See [Models](#models).

All of them use one endpoint, `POST /v1/systemone`, which follows Open System One, an open specification for System One model APIs. Why this shape suits accounting is covered in [AI Fundamentals](https://bkper.com/docs/ai/fundamentals.md#system-one-models).

## When to use one

| Your software needs                                                           | Ask                                                                                                            |
| ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| A yes or no, one of known options, or a level on a scale                      | A [decision question](#decision-questions)                                                                     |
| A value read from a document, such as an invoice number, a total, or a date   | An [extraction question](#extraction-questions)                                                                |
| A likely range for an uncertain number, such as days until an invoice is paid | An [extraction question](#extraction-questions)                                                                |
| Text, explanations, code, tool calls, or a custom JSON object                 | A [language model](https://bkper.com/docs/ai/models.md)                                                                            |
| A conversation that works on Books, computes, and delivers files              | An agent: [Bkper Agent](https://bkper.com/docs/ai/bkper-agent.md), or the [Managed Agent API](https://bkper.com/docs/api/managed-agent.md) in your app |

## Where you use them

- **In [Bkper CLI Agent](https://bkper.com/docs/ai/bkper-cli-agent.md#what-it-can-do)**, with no setup. Describe the outcome, such as "suggest Accounts for these bank lines and show me only the unsure ones", and the agent asks a System One model for you.
- **In apps and scripts**, with `POST /v1/systemone`, or with TypeSafe's SDK for decision questions. See [Add Bkper AI to an App](https://bkper.com/docs/platform/apps/ai.md#ask-a-system-one-model).
- **In open-source apps you can read.** The [Report app](https://github.com/bkper/bkper-apps/tree/main/report) breaks a report request into small judgments, such as which group and which period, and combines them in code. The [Merge Duplicates app](https://github.com/bkper/bkper-apps/tree/main/merge-duplicates) uses Jev to suggest duplicate pairs for a person to review.

## Models read and judge; code calculates

A System One model reads and judges. Your code does everything that must be exact:

- **The model** judges, such as which Account fits; reads values, such as an invoice total; and estimates uncertain numbers.
- **Your code** does arithmetic, totals, balances, amount matching, date windows, and thresholds; combines answers and facts into the decision; and makes every write to a Book.

The model never decides: it judges or reads, and your code decides.

An extraction question can also ask for a simple computed value, such as a due date from an issue date and payment terms. When a value feeds a Book, ask for its inputs and compute it in code: code gives the same answer every time, and a person can audit it.

An answer is a judgment or a reading, not permission to change a Book. When code posts, it records a normal Transaction, so the Book stays zero-sum whatever the model answered. Store the model revision, the rule that decided, and the answers it used as Transaction properties for the audit trail.

## Design a workflow

Design the decision in code first, then ask only the questions it needs.

1. **Start from what code will do.**

    List the actions, such as post, review, or skip, and write when each one happens, in priority order. These rules are the decision, and they live in code.

2. **Sort each condition into facts and judgments.**

    - **A fact** is anything code can look up or compute exactly: amounts, dates, matches, balances, and Book and Account properties. A value read by an extraction question becomes a fact once code checks it.
    - **A judgment** is what a knowledgeable person tells at a glance: what an item is, which Account fits, whether two entries record the same purchase.

    Code gathers the item and the context a person would need, such as nearby Transactions or how an Account is usually described, and passes them as named fields, such as `bank_line` and `existing_transaction`. Facts can also be images, such as a receipt photo. Convert PDFs and other files to text or images first.

3. **Ask one question per judgment.**

    Ask what an item is, never what to do with it. "Which Account fits?" is one judgment; "Post, review, or skip?" is the whole decision. Criteria only describe the options: amounts, dates, Book data, and which option wins belong in code. Write each question in full: the model sees your instructions and the state, never the name your code gives the question.

4. **Set thresholds by risk.**

    Decide how sure the model must be before code acts. A missed suggestion costs a person a few seconds; a duplicate posting misstates a Book. Keep thresholds in one reviewable place.

5. **Combine in code, and record why.**

    Code applies the rules in order to the answers and facts, acts when confident, and routes the rest to a person. This is TypeSafe's [confidence-gated routing](https://docs.typesafe.ai/patterns/confidence-routing) pattern. Log the rule that fired with the answers and facts it used: when an item goes the wrong way, you can tell whether a judgment or a rule was wrong.

6. **Measure and adjust.**

    Start with conservative thresholds and test them against your own records. Re-check them when the model's revision changes. To handle a new case, add a rule and, only if it needs one, a question: each question is answered independently, so existing answers and thresholds still hold.

### Example: a bank line

A bank line arrives: `AMAZON MKTPL*2K4LM`, 89.90 out of Checking. Code matches amounts and dates and finds a manual entry from the day before, "Printer toner, Amazon order 114-2K4LM". Those are facts. Then it asks for three judgments at once:

```bash
curl --fail-with-body https://ai.bkper.app/v1/systemone \
  -H "Authorization: Bearer ${BKPER_TOKEN}" \
  -H "Content-Type: application/json" \
  -H "bkper-ai-source: my-app" \
  --data '{
    "model": "jev",
    "state": {
      "bank_line": {
        "date": "2025-03-11",
        "description": "AMAZON MKTPL*2K4LM",
        "amount": 89.90,
        "direction": "money out of Checking"
      },
      "existing_transaction": {
        "date": "2025-03-10",
        "amount": 89.90,
        "from": "Checking",
        "to": "Office Supplies",
        "description": "Printer toner, Amazon order 114-2K4LM",
        "origin": "manual entry"
      }
    },
    "questions": {
      "account": {
        "type": "choice",
        "instructions": "Which Account should receive the money that left Checking in `bank_line`?",
        "criteria": {
          "Cloud Hosting": "Servers, cloud infrastructure, storage, and hosting providers",
          "Software Subscriptions": "SaaS tools and per-seat software licenses",
          "Office Supplies": "Physical supplies and equipment for the office",
          "Travel": "Flights, hotels, ground transport, and meals while traveling"
        }
      },
      "already_recorded": {
        "type": "noul",
        "instructions": "Does `existing_transaction` already record the movement in `bank_line`?"
      },
      "unusual": {
        "type": "score",
        "instructions": "How unusual is `bank_line` as a business expense?",
        "criteria": [
          "Routine: a common business expense",
          "Unusual: plausible, but uncommon for a business",
          "Suspicious: looks like fraud, an error, or a personal expense"
        ]
      }
    }
  }'
```

Jev and Clef answered:

| Question           | Jev                            | Clef                             |
| ------------------ | ------------------------------ | -------------------------------- |
| `account`          | Office Supplies, confidence 1  | Office Supplies, confidence 0.95 |
| `already_recorded` | Yes, with probability 0.91     | Yes, with probability 0.94       |
| `unusual`          | 0.17, Routine; confidence 0.74 | 0.29, Routine; confidence 0.45   |

Code then decides, with the rules in priority order:

```ts
// Keep thresholds in one reviewable place.
const DUPLICATE_THRESHOLD = 0.8;
const LARGE_AMOUNT = 1000;
const UNUSUAL_SCORE_THRESHOLD = 0.5;
const AUTO_POST_CONFIDENCE = 0.9;

interface BankLineAnswers {
    account: { type: 'choice'; choice: string; confidence: number };
    already_recorded: { type: 'noul'; noul: number };
    unusual: { type: 'score'; score: number; confidence: number };
}

interface BankLineFacts {
    amount: number;
}

type BankLineDecision =
    | { action: 'check-duplicate'; rule: 'already-recorded' }
    | {
          action: 'review';
          rule: 'large-amount' | 'unusual' | 'unsure-account';
          suggestedAccount: string;
      }
    | { action: 'post'; rule: 'confident-account'; toAccount: string };

// The first rule that matches decides.
export function decideBankLine(
    answers: BankLineAnswers,
    facts: BankLineFacts,
): BankLineDecision {
    const account = answers.account.choice;
    if (answers.already_recorded.noul >= DUPLICATE_THRESHOLD) {
        return { action: 'check-duplicate', rule: 'already-recorded' };
    }
    if (facts.amount >= LARGE_AMOUNT) {
        return { action: 'review', rule: 'large-amount', suggestedAccount: account };
    }
    if (answers.unusual.score >= UNUSUAL_SCORE_THRESHOLD) {
        return { action: 'review', rule: 'unusual', suggestedAccount: account };
    }
    if (answers.account.confidence < AUTO_POST_CONFIDENCE) {
        return { action: 'review', rule: 'unsure-account', suggestedAccount: account };
    }
    return { action: 'post', rule: 'confident-account', toAccount: account };
}
```

Both answers return `check-duplicate` by the `already-recorded` rule: the movement is probably already recorded, so code posts nothing. When code does post, it records a Transaction from Checking to the chosen Account. The risks to control are a duplicate movement and a wrong Account: the duplicate rule runs first, and code posts only when no other rule matches.

Whether an amount is large is a fact, so code checks it against `LARGE_AMOUNT` and no question mentions amounts. Asked whether 89.90 is large, the model could only guess what large means for this Book.

Context changes confidence. Asked about the bank line alone, without the manual entry, Jev still chose Office Supplies, but with confidence 0.77 and 0.12 on Software Subscriptions, so `decideBankLine` sends the line to review. Give the model the context a person would need.

For more designs, see TypeSafe's [Patterns](https://docs.typesafe.ai/patterns) and [Cookbooks](https://docs.typesafe.ai/cookbooks).

## Decision questions

Each decision question gets one typed answer:

| Ask                                | Example                                    | You get                                            |
| ---------------------------------- | ------------------------------------------ | -------------------------------------------------- |
| **Is this true?** (`noul`)         | Is this bank line already recorded?        | The probability of yes, from 0 to 1                |
| **Which one of these?** (`choice`) | Which Account should receive this payment? | One of your options, with a confidence from 0 to 1 |
| **Where on this scale?** (`score`) | How unusual is this expense?               | A position on your levels, with a confidence       |

Confidence is high when the model's probability concentrates on one answer. For _Is this true?_, the probability itself is the signal. Ask several questions about the same state in one request; the model answers each one independently.

Open System One also defines `box`, which locates something in an image. Bkper AI does not support it.

## Extraction questions

Each extraction question names the value to read and its type:

| Type       | Example                                | You get                                                  |
| ---------- | -------------------------------------- | -------------------------------------------------------- |
| `text`     | Invoice number                         | Text copied from the state                               |
| `number`   | Invoice total                          | A number, with optional `unit`, `integer`, and `decimals` |
| `date`     | Issue date                             | `YYYY-MM-DD`                                             |
| `time`     | Delivery time                          | 24-hour `HH:MM` or `HH:MM:SS`                            |
| `datetime` | Delivery date and time                 | `YYYY-MM-DDTHH:MM:SS`, with an offset only when the state gives one |
| `duration` | How long unloading takes               | A number in the question's `unit`, `seconds` by default  |
| `list`     | Each monthly invoice amount            | Every match of the `items` type, in input order          |
| `estimate` | Days until this invoice is paid        | A likely range between your `min` and `max`              |
| `forecast` | Amounts of the next monthly invoices   | One estimate per step, for `horizon` steps               |

Extraction answers come with rules your code can rely on:

- **Nulls.** A value answer has `value`, `p_null`, the probability that the state has no such value, and `confidence`. `value` is `null` when `p_null` is above the question's `null_threshold`, 0.5 by default. `guess`, the most likely value, is still there, so a person can check it.
- **Spans.** `span` points at the text the model read: a half-open `[start, end)` range of Unicode code point offsets. It indexes into `state_text` when the response has one, such as for JSON state, and into `state` otherwise. Use it to highlight the source for a reviewer. Computed values, and values read from images, have no span.
- **Lists** are never `null`: no match is an empty list.
- **Estimates** are never `null`. They return `median`, with `p10` and `p90` bounding the likely range, all within `[min, max]` and on the `step` grid. Set `quantiles: true` to also get the 1st to 99th percentiles. A forecast returns exactly `horizon` estimates in `steps`, nearest first.
- **Truncation.** `truncated: true` means the model read only the start of the state. Send such items to review, or split the state.
- **Reference date.** Send `reference_date`, as `YYYY-MM-DD`, to resolve relative and year-less dates, such as "March 9".

### Example: a supplier email

This request body reads a supplier email. Send it to `POST /v1/systemone` like the bank-line request:

```json
{
    "model": "clairic",
    "state": "Hi, this is Marta Silva from Acme Paper. Invoice AP-5531 for 3 boxes of A4 paper is attached: total $184.50, issued 2026-03-02 with net 30 terms. Delivery is booked for March 9 at 10:15 am, and unloading takes about 40 minutes. Our last four monthly invoices were $172.00, $178.25, $181.10 and $184.50.",
    "reference_date": "2026-03-05",
    "questions": {
        "invoice_number": { "type": "text", "instructions": "Invoice number" },
        "total": {
            "type": "number",
            "decimals": 2,
            "unit": "USD",
            "instructions": "Invoice total"
        },
        "issue_date": { "type": "date", "instructions": "Invoice issue date" },
        "days_to_pay": {
            "type": "estimate",
            "min": 0,
            "max": 90,
            "step": 1,
            "instructions": "Days after issue until this invoice is paid"
        },
        "po_number": {
            "type": "text",
            "instructions": "Purchase order number"
        }
    }
}
```

Clairic answered:

| Question         | Answer                                                                                              |
| ---------------- | --------------------------------------------------------------------------------------------------- |
| `invoice_number` | `AP-5531`, read at span `[49, 56]`                                                                  |
| `total`          | `184.5`                                                                                             |
| `issue_date`     | `2026-03-02`                                                                                        |
| `days_to_pay`    | Median 30, between 24 and 32                                                                        |
| `po_number`      | `null`, with `p_null` close to 1: the email has no purchase order number. The `guess`, `AP-5531`, is the invoice number. |

Code computes the due date from the issue date and the 30-day terms, and checks the total against the invoice lines before it records anything.

## Models

Each model lists the question types it answers in `question_types` in the [`GET /v1/models`](https://ai.bkper.app/v1/models) catalog. Choose a model that answers every question type in your request; any other type returns `unsupported_question_type`. Thresholds tuned on one model do not carry over to another, so test each on your own records.

|                                 | Jev, by TypeSafe           | Clef, by Cloudflare         | Clairic, by Cloudflare                                                          |
| ------------------------------- | -------------------------- | --------------------------- | ------------------------------------------------------------------------------- |
| Model ID                        | `jev`                      | `clef`                      | `clairic`                                                                       |
| Question types                  | `noul`, `choice`, `score`  | `noul`, `choice`, `score`   | `text`, `number`, `date`, `time`, `datetime`, `duration`, `list`, `estimate`, `forecast` |
| State and questions per request | Up to 32,768 tokens        | Up to 65,536 tokens         | Up to 65,536 tokens; longer state is truncated                                  |
| Images                          | PNG and JPEG, experimental | Up to 4: PNG, JPEG, or WebP | Up to 4: PNG, JPEG, or WebP                                                     |
| Status                          | Available                  | Available                   | Preview                                                                         |

For decision questions, start with Jev: it has the lower [usage rate](https://bkper.com/docs/ai/models.md#usage-rates). Choose Clef when the state and questions exceed Jev's limit, or when you send WebP images. For extraction questions, use Clairic.

### Jev

- **Versions.** `jev-latest` and versioned IDs are accepted but always select the current Jev; you cannot pin a version. Log the revision each answer reports, and re-check tuned thresholds when it changes.
- **Language.** English is Jev's primary training language; other languages work with lower accuracy.
- **Images.** An experimental TypeSafe feature, so accuracy and limits can change. Send PNG or JPEG images between 280 and 1568 pixels per side, with TypeSafe's SDKs or as base64 `assets` in a JSON request. Image tokens count as input. See TypeSafe's [Images](https://docs.typesafe.ai/images) guide.
- **Known weak spots.** Literal reading, arithmetic, date comparison, and large states full of irrelevant detail. See [Jev 1.13 jaggedness](https://docs.typesafe.ai/model-jaggedness/jev-1.13).

### Clef

- **Limits.** Up to 64 questions per request and at least 2 options per `choice` question. Up to 4 images of 4 MiB each, 8 MiB in total, read before the state.

### Clairic

- **Preview.** Its answers and limits can change before general availability.
- **Limits.** Question names of up to 64 characters and forecasts of up to 64 steps. Up to 4 images of 4 MiB each, 8 MiB in total.

## Common mistakes

- **Asking the model to calculate.** Match amounts, compute dates, and check balances in code.
- **Asking for the decision.** Ask what an item is, such as which Account fits, not what to do with it, such as post or review. Ask one judgment or one value per question, and combine the answers in code.
- **Writing rules into criteria.** If a criterion mentions an amount, a date, Book data, another option, or which option wins, such as "even if" or "not if", that part is a rule: move it to code.
- **Putting the question in its name.** The model never sees question IDs. Write the full question in its instructions.
- **Treating answers as verdicts.** A probability of yes is not a boolean, and a score can fall between levels. Compare both with thresholds.
- **Ignoring nulls and guesses.** A `null` value is an answer: the state probably lacks it. Show the `guess` to a person instead of discarding it.
- **Expecting an explanation.** System One models return no text. Use a [language model](https://bkper.com/docs/ai/models.md) when you need one.
- **Sending a language-model request.** A System One request carries only the model, the state, the questions, image `assets`, and `reference_date` for extraction questions. See the [request rules](https://bkper.com/docs/api/ai-gateway.md#decision-request).

## Next steps

- [Add Bkper AI to an App](https://bkper.com/docs/platform/apps/ai.md#ask-a-system-one-model) — call System One models from an app Worker, a script, or a browser.
- [AI Gateway API: decision questions](https://bkper.com/docs/api/ai-gateway.md#decision-questions) — the request, answer guarantees, errors, and compatibility with TypeSafe.
- [AI Gateway API: extraction questions](https://bkper.com/docs/api/ai-gateway.md#extraction-questions) — question settings, limits, and answer guarantees.
- [Open System One](https://github.com/opensystemoneorg/opensystemone) — the open specification behind `POST /v1/systemone`: question types, answer guarantees, and errors.
- [Models and Usage](https://bkper.com/docs/ai/models.md) — usage rates, the allowance, and privacy.
- Building with a coding agent? Point it to this page for design, and to `https://bkper.com/docs/api/ai-gateway.md` for the endpoint, authentication, and errors. TypeSafe's [agent skill](https://docs.typesafe.ai/agent-skill) adds questions and patterns for decision questions.
- TypeSafe: [System One](https://docs.typesafe.ai/concepts/system-one), [How to build with System One](https://docs.typesafe.ai/concepts/how-to-build-with-system-one), [State](https://docs.typesafe.ai/concepts/state), [Confidence](https://docs.typesafe.ai/confidence), and [Patterns](https://docs.typesafe.ai/patterns).
- [Back to AI overview](https://bkper.com/docs/ai.md).
