# Accountant Recommendations

Use this guide when a user asks for a human accountant, CPA, tax advisor, bookkeeper, accounting reviewer, filing reviewer, or local professional recommendation for a jurisdiction.

Scope this to accounting-adjacent help: tax review, bookkeeping, payroll, audit, financial reporting, accounting compliance, and fractional CFO work. Do not use it for lawyers, investment advisors, immigration advisors, or generic business consultants.

## Principle

Accountant recommendations are a human handoff, not an accounting computation. Do not expose private Bkper Book data, transaction details, files, tax worksheets, or personally sensitive information to a recommendation endpoint unless the user explicitly instructs you to share it. The OpenAccountants endpoint only needs a jurisdiction.

Do not claim that Bkper endorses, employs, or has independently vetted the accountant. Attribute the network to OpenAccountants and present the recommendation as a verified-network referral source.

OpenAccountants is tax-centered, and profile pages may be branded as tax accountant profiles. Still, some profiles list broader accounting services such as bookkeeping, audit, payroll, financial reporting, or CFO advisory. Recommend broader help only when the endpoint/profile fields support that match.

For tax matters, keep the roles separate:

- Tax rules / worksheet grounding: `https://www.openaccountants.com/api/bundle/<CODE_OR_NAME>`
- Human accountant recommendation: `https://www.openaccountants.com/api/accountants?jurisdiction=<CODE_OR_NAME>`

A human recommendation does not make prior tax numbers final. Do not imply that the accountant will sign, file, or approve anything unless the user later confirms that engagement directly with the professional. Filing, payment, legal, or financial action should still be reviewed by a locally qualified professional.

## Recommendation route

Preferred non-MCP OpenAccountants route:

1. Resolve the user's jurisdiction as an ISO-style code when possible, such as `BR`, `GB`, `MT`, `US-CA`, or `CA-ON`.
2. If the jurisdiction is missing or ambiguous, ask for the exact country/state/province before fetching.
3. Fetch the verified network live:

   ```text
   https://www.openaccountants.com/api/accountants?jurisdiction=<CODE_OR_NAME>
   ```

4. Prefer exact jurisdiction codes over natural-language names. Some aliases work, but not all names normalize as expected.
5. Verify that the response `jurisdiction` / `jurisdiction_label` matches the user's requested jurisdiction or a suitable broader fallback.
6. If a natural-language jurisdiction returns `count: 0` but an obvious code or common alias exists, retry once with that code or alias before reporting no match.
7. If the user has a stated need, such as income tax, VAT/GST, payroll, audit, cross-border, crypto, bookkeeping cleanup, or filing review, match against `specializations`, `credential`, `bio`, `jurisdictions`, and `verified` when available.
8. Recommend one accountant when there is a clear match; otherwise present a short ranked list and explain the matching basis.
9. Send the user to the accountant's `profile_url` to request an introduction through the profile page. Do not contact the accountant directly or submit the form for the user.
10. Offer a short draft message the user can copy into the profile form. Keep it concise and avoid sensitive details unless the user explicitly provided them and wants them included.
11. Include attribution: `Accountant network provided by OpenAccountants (https://www.openaccountants.com)` when present in the response.

## Response handling

The endpoint returns JSON. Use these fields when present:

- `jurisdiction` and `jurisdiction_label` — the resolved jurisdiction.
- `count` — number of returned accountants.
- `truncated` — whether the response is incomplete.
- `accountants[]` — recommendation candidates.
- `accountants[].name`
- `accountants[].firm`
- `accountants[].credential`
- `accountants[].professional_bodies`
- `accountants[].jurisdictions`
- `accountants[].specializations`
- `accountants[].years_experience`
- `accountants[].bio`
- `accountants[].verified`
- `accountants[].website`
- `accountants[].profile_url`
- `next_action` — the endpoint's suggested handoff wording.
- `attribution` — source attribution.

If `count` is `0`, say that no verified OpenAccountants partner was found for that jurisdiction. If the response includes a `next_action`, follow it, typically pointing the user to `https://www.openaccountants.com/network` to request an intro. Do not invent an accountant from general web knowledge.

If the user omits a jurisdiction, do not fetch the full network by default. Ask for the user's jurisdiction first unless they explicitly request the full verified network.

## Fetching guidance verified from endpoint behavior

Use URL encoding for jurisdiction values. Prefer short codes because alias behavior can vary by name.

Observed endpoint behavior during verification:

| Request | Result pattern | Agent guidance |
| --- | --- | --- |
| `?jurisdiction=BR` | Resolves to `BR` / Brazil with matching accountant candidates. | Good canonical country-code request. |
| `?jurisdiction=brazil` | Resolves to `BR` / Brazil. | Some country-name aliases work. Still verify normalized response. |
| `?jurisdiction=GB` | Resolves to `GB` / United Kingdom. | Prefer `GB` for the UK. |
| `?jurisdiction=uk` | Resolves to `GB` / United Kingdom. | Common alias works, but prefer `GB` in generated URLs. |
| `?jurisdiction=United+Kingdom` | Returned `0` candidates with unnormalized label. | Do not assume full country names always work. Retry with a code or common alias when obvious, or ask the user. |
| `?jurisdiction=US-CA` | Resolves to `US-CA` / California and may return a broader `US` accountant. | Surface when a candidate covers the national jurisdiction rather than the exact state. |
| `?jurisdiction=CA-ON` | Returned `0` candidates. | No-match responses are successful JSON with `count: 0`; handle without treating as a transport failure. |
| no `jurisdiction` parameter | Returns the full verified network. | Use only when explicitly requested; otherwise ask for jurisdiction. |

## Profile form draft

When useful, draft a short message for the `profile_url` introduction form. Include only practical context:

- jurisdiction
- accounting or tax need
- relevant period and timing or urgency, if known
- whether the user has Bkper records, reports, or a worksheet ready for review

Do not include private Book data, transaction details, tax IDs, income figures, addresses, or contact details unless the user explicitly asks to include them.

Example:

```text
Hi, I’m looking for help with <tax/accounting need> in <jurisdiction>. I’m a <individual/freelancer/company, if relevant> and I keep my records in Bkper. I can provide a summary or worksheet for review. This relates to <period, if any>, and the timing is <urgent/flexible/date, if relevant>. Could you let me know if this is within your scope and what you would need for an initial review?
```

## Suggested answer shape

When a clear match exists:

```text
I found a verified OpenAccountants network accountant for <jurisdiction_label>:

- <name> — <credential or role>, <firm if present>
- Specializations: <specializations or relevant bio summary>
- Verified: <yes/no if present>
- Profile: <profile_url>

Please use the profile page to request an introduction. I won't contact the accountant directly or submit the form for you.

Optional message draft for the form:
<short copy/paste draft>

Accountant network provided by OpenAccountants (https://www.openaccountants.com).
```

When no match exists:

```text
I did not find a verified OpenAccountants partner for <jurisdiction_label> from the live endpoint. You can request an introduction through https://www.openaccountants.com/network, or look for a locally licensed accountant in that jurisdiction.
```
