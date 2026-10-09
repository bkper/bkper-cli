# Decision Models

A decision model judges; your code decides. It reads the facts your code gives it, such as a bank line, and answers narrow questions in a shape you set in advance: how likely something is true, which of your options fits, or where it sits on your scale. It writes no text, and it reports how sure it is as a number your code can compare.

Why that suits accounting is covered in [AI Fundamentals](https://bkper.com/docs/ai/fundamentals.md#decision-models). This page is about designing with decision models. [Jev](#jev-by-typesafe), by TypeSafe, is Bkper's first.

## When to use one

| Your software needs                                              | Use                                                                                                        |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| A yes or no, one of known options, or a level on a scale         | A decision model                                                                                           |
| Text, explanations, code, tool calls, or a custom JSON object    | A [language model](https://bkper.com/docs/ai/models.md)                                                                        |
| A conversation that works on Books, computes, and delivers files | An agent: [Bkper Agent](https://bkper.com/docs/ai/bkper-agent.md), or the [Managed Agent API](https://bkper.com/docs/api/managed-agent.md) in your app |

## Where you use them

- **In [Bkper CLI Agent](https://bkper.com/docs/ai/bkper-cli-agent.md#what-it-can-do)**, with no setup. Describe the outcome, such as "suggest Accounts for these bank lines and show me only the unsure ones", and the agent asks the decision model for you.
- **In apps and scripts**, with TypeSafe's SDK. See [Add Bkper AI to an App](https://bkper.com/docs/platform/apps/ai.md#ask-a-decision-model). The open-source [Merge Duplicates app](https://github.com/bkper/bkper-apps/tree/main/merge-duplicates) uses one to suggest duplicate pairs for a person to review.

## Three kinds of question

Each question gets one typed answer:

| Ask                                | Example                                       | You get                                              |
| ---------------------------------- | --------------------------------------------- | ---------------------------------------------------- |
| **Is this true?** (`noul`)         | Is this bank line already recorded?           | The probability of yes, from 0 to 1                  |
| **Which one of these?** (`choice`) | Which Account should receive this payment?    | One of your options, with a confidence from 0 to 1   |
| **Where on this scale?** (`score`) | How urgently should someone review this line? | A position on your levels, with a confidence         |

Confidence is high when the model's probability concentrates on one answer. For _Is this true?_, the probability itself is the signal. Ask several questions about the same facts in one request; the model answers each one independently.

## Design a decision workflow

1. **Find the judgment.**

    Look for the step where a person glances and decides: which Account, is this a duplicate, does this need a second look. A good question is a snap judgment that a knowledgeable person makes in seconds.

2. **Let code gather the facts.**

    Code fetches the item and the context a person would need, such as nearby Transactions, how an Account is usually described, or Book and Account properties. Pass them as named fields, such as `bank_line` and `existing_transaction`. Decision models read text only, so convert files and images to text first.

3. **Ask narrow questions.**

    Ask one judgment per question. Split bigger judgments into several questions and combine the answers in code. Write each question in full: the model sees your instructions and the facts, never the name your code gives the question.

4. **Keep calculation in code.**

    Match amounts, compute date windows, and check balances in code, then ask the model only the part that needs judgment. For example, find Transactions with the same amount inside a date window, then ask only whether their descriptions describe the same movement.

5. **Set thresholds by risk.**

    Decide how sure the model must be before code acts. A missed suggestion costs a person a few seconds; a duplicate posting misstates a Book. Keep thresholds in one reviewable place.

6. **Act when confident; send the rest to a person.**

    Code acts on answers above the threshold and routes the rest to review. This is TypeSafe's [confidence-gated routing](https://docs.typesafe.ai/patterns/confidence-routing) pattern.

7. **Keep Book writes in code.**

    An answer is a judgment, not permission to change a Book. When code posts, it records a normal Transaction, so the Book stays zero-sum whatever the model answered. Store the model revision and the confidence as Transaction properties for the audit trail.

8. **Measure and adjust.**

    Start with conservative thresholds and test them against your own records. Re-check them when the model's revision changes.

## Putting it all together

A bank line arrives: `AMAZON MKTPL*2K4LM`, 89.90 out of Checking. Code finds a manual entry from the day before with the same amount, "Printer toner, Amazon order 114-2K4LM", and asks three questions at once. Jev answered:

| Question                                                                                                  | Answer                         |
| --------------------------------------------------------------------------------------------------------- | ------------------------------ |
| Which Account should receive the money? Cloud Hosting, Software Subscriptions, Office Supplies, or Travel | Office Supplies, confidence 1  |
| Does the existing entry already record this movement?                                                    | Yes, with probability 0.89     |
| How urgently should a bookkeeper review it? Routine, Check, or Urgent                                     | 0.09, Routine; confidence 0.86 |

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

These answers return `check-duplicate`: the movement is probably already recorded, so code posts nothing. When code does post, it records a Transaction from Checking to the chosen Account. The risks to control are a wrong Account and a duplicate movement, which is why those checks come first.

The exact request and response are in the [AI Gateway API guide](https://bkper.com/docs/api/ai-gateway.md#decision-models).

### Context changes confidence

Ask about the same bank line without the manual entry, and the answer changes:

| Facts given                         | Which Account?                                                        |
| ----------------------------------- | --------------------------------------------------------------------- |
| The bank line and the manual entry  | Office Supplies, confidence 1                                         |
| The bank line alone                 | Office Supplies, confidence 0.75, with 0.14 on Software Subscriptions |

The top option is the same, but the model reports that it is less sure, so `decideBankLine` sends the line to review. Give the model the context a person would need.

For more designs, see TypeSafe's [Patterns](https://docs.typesafe.ai/patterns) and [Cookbooks](https://docs.typesafe.ai/cookbooks).

## Common mistakes

- **Asking for analysis.** Ask one snap judgment per question and combine the answers in code.
- **Asking the model to calculate.** Match amounts, compute date windows, and check balances in code.
- **Putting the question in its name.** The model never sees question IDs. Write the full question in its instructions.
- **Treating answers as verdicts.** A probability of yes is not a boolean, and a score can fall between levels. Compare both with thresholds.
- **Expecting an explanation.** Decision models return no text. Use a [language model](https://bkper.com/docs/ai/models.md) when you need one.
- **Sending a language-model request.** A decision request carries only the model, the facts, and the questions. See the [request rules](https://bkper.com/docs/api/ai-gateway.md#decision-request).

## Jev by TypeSafe

[Jev](https://docs.typesafe.ai/introduction) is TypeSafe's flagship model and the first System One model. Its Bkper model ID is `jev`.

- **Versions.** `jev-latest` and versioned IDs are accepted but always select the current Jev; you cannot pin a version. Log the revision each answer reports, and re-check tuned thresholds when it changes.
- **Input.** Text only. English is Jev's primary training language; other languages work with lower accuracy.
- **Known weak spots.** Literal reading, arithmetic, date comparison, and large states full of irrelevant detail. See [Jev 1.13 jaggedness](https://docs.typesafe.ai/model-jaggedness/jev-1.13).

Requests count against your Bkper AI allowance at Jev's [usage rates](https://bkper.com/docs/ai/models.md#usage-rates).

## Build it

- [Add Bkper AI to an App](https://bkper.com/docs/platform/apps/ai.md#ask-a-decision-model) — ask a decision model from an app Worker, a script, or a browser with TypeSafe's SDK.
- [AI Gateway API: decision models](https://bkper.com/docs/api/ai-gateway.md#decision-models) — the request, answer guarantees, errors, caching, and compatibility with TypeSafe.
- [`createDecision` reference](https://bkper.com/docs/api/ai-gateway/operations/createdecision.md) — every field.
- [Models and Usage](https://bkper.com/docs/ai/models.md) — usage rates, the allowance, and privacy.
- Building with a coding agent? Point it to this page for design, and to `https://bkper.com/docs/api/ai-gateway.md` for the endpoint, authentication, and errors. TypeSafe's [agent skill](https://docs.typesafe.ai/agent-skill) adds questions and patterns.
- TypeSafe: [System One](https://docs.typesafe.ai/concepts/system-one), [How to build with System One](https://docs.typesafe.ai/concepts/how-to-build-with-system-one), [AI primer](https://docs.typesafe.ai/introduction/machine-learning-primer), [Primitives](https://docs.typesafe.ai/primitives), [State](https://docs.typesafe.ai/concepts/state), [Confidence](https://docs.typesafe.ai/confidence), and [Patterns](https://docs.typesafe.ai/patterns).
- [Back to AI overview](https://bkper.com/docs/ai.md).
