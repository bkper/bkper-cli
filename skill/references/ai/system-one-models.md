# System One Models

A System One model answers typed questions about one input, called the state, such as a bank line or a supplier email. It writes no text. Each answer comes back in a shape you set in advance, with a probability or confidence your code can compare.

There are two kinds:

- **Decision models judge.** Is this bank line already recorded? Which Account fits it? [Jev and Clef](#jev-and-clef) are decision models.
- **Extraction models read.** What are the invoice number, the total, and the issue date? [Clairic](#clairic-preview), in preview, is an extraction model.

Both kinds use one endpoint, `POST /v1/systemone`, which follows Open System One, an open specification for System One model APIs. Why this shape suits accounting is covered in [AI Fundamentals](https://bkper.com/docs/ai/fundamentals.md#system-one-models).

## When to use one

| Your software needs                                                         | Use                                                                                                            |
| --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| A yes or no, one of known options, or a level on a scale                    | A decision model                                                                                               |
| A value read from a document, such as an invoice number, a total, or a date | An extraction model                                                                                            |
| A likely range for an uncertain number, such as days until an invoice is paid | An extraction model                                                                                          |
| Text, explanations, code, tool calls, or a custom JSON object               | A [language model](https://bkper.com/docs/ai/models.md)                                                                            |
| A conversation that works on Books, computes, and delivers files            | An agent: [Bkper Agent](https://bkper.com/docs/ai/bkper-agent.md), or the [Managed Agent API](https://bkper.com/docs/api/managed-agent.md) in your app |

## Where you use them

- **In [Bkper CLI Agent](https://bkper.com/docs/ai/bkper-cli-agent.md#what-it-can-do)**, with no setup. Describe the outcome, such as "suggest Accounts for these bank lines and show me only the unsure ones", and the agent asks a decision model for you.
- **In apps and scripts**, with `POST /v1/systemone`, or with TypeSafe's SDK for decision models. See [Add Bkper AI to an App](https://bkper.com/docs/platform/apps/ai.md#ask-a-decision-model). The open-source [Merge Duplicates app](https://github.com/bkper/bkper-apps/tree/main/merge-duplicates) uses Jev to suggest duplicate pairs for a person to review.

## Models read and judge; code calculates

A System One model reads and judges. Your code does everything that must be exact:

- **The model** judges, such as which Account fits; reads values, such as an invoice total; and estimates uncertain numbers.
- **Your code** does arithmetic, totals, balances, amount matching, date windows, and thresholds, and every write to a Book.

Clairic can compute simple values, such as a due date from an issue date and payment terms. When a value feeds a Book, ask for its inputs and compute it in code: code gives the same answer every time, and a person can audit it.

An answer is a judgment or a reading, not permission to change a Book. When code posts, it records a normal Transaction, so the Book stays zero-sum whatever the model answered. Store the model revision and the confidence as Transaction properties for the audit trail.

## Decision models

Each decision question gets one typed answer:

| Ask                                | Example                                       | You get                                            |
| ---------------------------------- | --------------------------------------------- | -------------------------------------------------- |
| **Is this true?** (`noul`)         | Is this bank line already recorded?           | The probability of yes, from 0 to 1                |
| **Which one of these?** (`choice`) | Which Account should receive this payment?    | One of your options, with a confidence from 0 to 1 |
| **Where on this scale?** (`score`) | How urgently should someone review this line? | A position on your levels, with a confidence       |

Confidence is high when the model's probability concentrates on one answer. For _Is this true?_, the probability itself is the signal. Ask several questions about the same state in one request; the model answers each one independently.

### Jev and Clef

|                               | Jev, by TypeSafe                     | Clef, by Cloudflare                 |
| ----------------------------- | ------------------------------------ | ----------------------------------- |
| Model ID                      | `jev`                                | `clef`                              |
| Question types                | `noul`, `choice`, `score`            | `noul`, `choice`, `score`           |
| State and questions per request | Up to 32,768 tokens                | Up to 65,536 tokens                 |
| Images                        | PNG and JPEG, experimental           | Up to 4: PNG, JPEG, or WebP         |

Start with Jev: it has the lower [usage rate](https://bkper.com/docs/ai/models.md#usage-rates). Choose Clef when the state and questions exceed Jev's limit, or when you send WebP images. Thresholds tuned on one model do not carry over to the other, so test each on your own records.

Jev notes:

- **Versions.** `jev-latest` and versioned IDs are accepted but always select the current Jev; you cannot pin a version. Log the revision each answer reports, and re-check tuned thresholds when it changes.
- **Language.** English is Jev's primary training language; other languages work with lower accuracy.
- **Images.** An experimental TypeSafe feature, so accuracy and limits can change. Send PNG or JPEG images between 280 and 1568 pixels per side as base64 `assets` in a JSON request; TypeSafe's SDKs upload images in a form Bkper AI does not accept. Image tokens count as input. See TypeSafe's [Images](https://docs.typesafe.ai/images) guide.
- **Known weak spots.** Literal reading, arithmetic, date comparison, and large states full of irrelevant detail. See [Jev 1.13 jaggedness](https://docs.typesafe.ai/model-jaggedness/jev-1.13).

Clef notes:

- **Limits.** Up to 64 questions per request and at least 2 options per `choice` question. Up to 4 images of 4 MiB each, 8 MiB in total, read before the state.

### Design a decision workflow

1. **Find the judgment.**

    Look for the step where a person glances and decides: which Account, is this a duplicate, does this need a second look. A good question is a snap judgment that a knowledgeable person makes in seconds.

2. **Let code gather the facts.**

    Code fetches the item and the context a person would need, such as nearby Transactions, how an Account is usually described, or Book and Account properties. Pass them as named fields, such as `bank_line` and `existing_transaction`. Facts can also be images, such as a receipt photo. Convert PDFs and other files to text or images first.

3. **Ask narrow questions.**

    Ask one judgment per question. Split bigger judgments into several questions and combine the answers in code. Write each question in full: the model sees your instructions and the state, never the name your code gives the question.

4. **Set thresholds by risk.**

    Decide how sure the model must be before code acts. A missed suggestion costs a person a few seconds; a duplicate posting misstates a Book. Keep thresholds in one reviewable place.

5. **Act when confident; send the rest to a person.**

    Code acts on answers above the threshold and routes the rest to review. This is TypeSafe's [confidence-gated routing](https://docs.typesafe.ai/patterns/confidence-routing) pattern.

6. **Measure and adjust.**

    Start with conservative thresholds and test them against your own records. Re-check them when the model's revision changes.

### Example: a bank line

A bank line arrives: `AMAZON MKTPL*2K4LM`, 89.90 out of Checking. Code matches amounts and dates and finds a manual entry from the day before, "Printer toner, Amazon order 114-2K4LM". Then it asks three questions at once:

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
      "review_priority": {
        "type": "score",
        "instructions": "How urgently should a bookkeeper review `bank_line`?",
        "criteria": [
          "Routine: consistent with normal activity",
          "Check: unusual but plausibly legitimate",
          "Urgent: large, unapproved, or suspicious"
        ]
      }
    }
  }'
```

Jev and Clef answered:

| Question             | Jev                            | Clef                            |
| -------------------- | ------------------------------ | ------------------------------- |
| `account`            | Office Supplies, confidence 1  | Office Supplies, confidence 0.93 |
| `already_recorded`   | Yes, with probability 0.89     | Yes, with probability 0.94      |
| `review_priority`    | 0.09, Routine; confidence 0.86 | 0.12, Routine; confidence 0.74  |

Code then decides:

```ts
// Keep questions and thresholds in one reviewable place.
const DUPLICATE_THRESHOLD = 0.8;
const REVIEW_SCORE_THRESHOLD = 1.5;
const AUTO_POST_CONFIDENCE = 0.9;

interface BankLineAnswers {
    account: { type: 'choice'; choice: string; confidence: number };
    already_recorded: { type: 'noul'; noul: number };
    review_priority: { type: 'score'; score: number; confidence: number };
}

type BankLineDecision =
    | { action: 'check-duplicate' }
    | { action: 'review'; suggestedAccount: string }
    | { action: 'post'; toAccount: string; confidence: number };

export function decideBankLine(answers: BankLineAnswers): BankLineDecision {
    if (answers.already_recorded.noul >= DUPLICATE_THRESHOLD) {
        return { action: 'check-duplicate' };
    }
    if (
        answers.review_priority.score >= REVIEW_SCORE_THRESHOLD ||
        answers.account.confidence < AUTO_POST_CONFIDENCE
    ) {
        return { action: 'review', suggestedAccount: answers.account.choice };
    }
    return {
        action: 'post',
        toAccount: answers.account.choice,
        confidence: answers.account.confidence,
    };
}
```

Both answers return `check-duplicate`: the movement is probably already recorded, so code posts nothing. When code does post, it records a Transaction from Checking to the chosen Account. The risks to control are a wrong Account and a duplicate movement, which is why those checks come first.

Context changes confidence. Asked about the bank line alone, without the manual entry, Jev still chose Office Supplies, but with confidence 0.75 and 0.14 on Software Subscriptions, so `decideBankLine` sends the line to review. Give the model the context a person would need.

For more designs, see TypeSafe's [Patterns](https://docs.typesafe.ai/patterns) and [Cookbooks](https://docs.typesafe.ai/cookbooks).

## Extraction models

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

### Clairic (preview)

Clairic, by Cloudflare, answers every extraction question type, with model ID `clairic`. It is a preview: its answers and limits can change before general availability.

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

## Common mistakes

- **Asking the model to calculate.** Match amounts, compute dates, and check balances in code.
- **Asking for analysis.** Ask one snap judgment or one value per question, and combine the answers in code.
- **Putting the question in its name.** The model never sees question IDs. Write the full question in its instructions.
- **Treating answers as verdicts.** A probability of yes is not a boolean, and a score can fall between levels. Compare both with thresholds.
- **Ignoring nulls and guesses.** A `null` value is an answer: the state probably lacks it. Show the `guess` to a person instead of discarding it.
- **Expecting an explanation.** System One models return no text. Use a [language model](https://bkper.com/docs/ai/models.md) when you need one.
- **Sending a language-model request.** A System One request carries only the model, the state, the questions, image `assets`, and `reference_date` for extraction models. See the [request rules](https://bkper.com/docs/api/ai-gateway.md#decision-request).

## Next steps

- [Add Bkper AI to an App](https://bkper.com/docs/platform/apps/ai.md#ask-a-decision-model) — call System One models from an app Worker, a script, or a browser.
- [AI Gateway API: decision models](https://bkper.com/docs/api/ai-gateway.md#decision-models) — the request, answer guarantees, errors, caching, and compatibility with TypeSafe.
- [AI Gateway API: extraction models](https://bkper.com/docs/api/ai-gateway.md#extraction-models) — question settings, limits, and answer guarantees.
- [Open System One](https://github.com/bkper/open-systemone) — the open specification behind `POST /v1/systemone`: question types, answer guarantees, and errors.
- [Models and Usage](https://bkper.com/docs/ai/models.md) — usage rates, the allowance, and privacy.
- Building with a coding agent? Point it to this page for design, and to `https://bkper.com/docs/api/ai-gateway.md` for the endpoint, authentication, and errors. TypeSafe's [agent skill](https://docs.typesafe.ai/agent-skill) adds questions and patterns for decision models.
- TypeSafe: [System One](https://docs.typesafe.ai/concepts/system-one), [How to build with System One](https://docs.typesafe.ai/concepts/how-to-build-with-system-one), [State](https://docs.typesafe.ai/concepts/state), [Confidence](https://docs.typesafe.ai/confidence), and [Patterns](https://docs.typesafe.ai/patterns).
- [Back to AI overview](https://bkper.com/docs/ai.md).
