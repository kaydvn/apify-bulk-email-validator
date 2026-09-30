# Bulk Email Validator: syntax, typos, disposable, role and MX checks

Clean an email list in minutes: for each address you get a **result (ok / risky / invalid)**, a **0-100 score**, the reasons, a **"did you mean" fix** for typos like `gmial.com`, disposable and role-address flags, the **mail servers** of the domain and the **mail provider** (Google Workspace, Microsoft 365, Zoho...).

> This actor is built and operated by an AI agent (mmaker), with human oversight. Issues are read and fixed.

## What it checks (and what it does not)
| Check | Detail |
|---|---|
| Syntax | RFC-style local part and domain rules, length limits, IDN domains converted to punycode, `Name <a@b.com>` and `mailto:` cleaned |
| Domain DNS | MX lookup per domain (cached). No MX but an A record is flagged. Domains that do not exist, or publish a null MX, are invalid |
| Typos | Suggests a fix for near-misses of major providers (`gmial.com`, `hotmail.con`) |
| Disposable | 9,000+ throwaway domains (CC0 list `disposable-email-domains`), including subdomains |
| Role addresses | `info@`, `admin@`, `support@`, `noreply@`... |
| Provider | Google, Microsoft, Zoho, Proofpoint, Mimecast, Yahoo, GoDaddy and more, from the MX hosts |

**It does not open SMTP connections**, so it cannot prove that a specific mailbox exists or detect catch-all servers. Treat `ok` as "well-formed address on a domain that accepts mail", which removes the bulk of bounces (typos, dead domains, fake and throwaway addresses) at a fraction of the price of SMTP verifiers. If your sender reputation is critical, follow up with an SMTP verifier on the `ok` rows.

## How to use
1. Paste addresses into **Emails**, or paste a column / CSV text into **Emails as text**.
2. Click **Start**. Results land in a dataset you can download as JSON, CSV or Excel.
3. Keep `result = ok`, review `risky`, drop `invalid`.

## Input
| Field | Description |
|---|---|
| `emails` | List of addresses. Duplicates are skipped |
| `emailsText` | Text with addresses separated by new lines, commas, semicolons or spaces |
| `checkDns` | Default `true`. Turn off for a syntax, disposable and typo check only |
| `concurrency` | 1-100 parallel checks, default 25 |

## Output (one row per unique address)
```json
{"email":"bob@gmial.com","result":"risky","score":0,"reasons":["disposable_domain","possible_typo:gmail.com"],"local":"bob","domain":"gmial.com","isDisposable":true,"isRole":false,"isFreeProvider":false,"didYouMean":"bob@gmail.com","mxHosts":null,"mailProvider":null}
```
A `SUMMARY` record in the key-value store has the totals per result.

**Scoring.** Start at 100. Disposable -70, possible typo -45, role address -20, no MX record (A record only) -25, DNS error -30. Below 80 is `risky`; invalid syntax, unknown domains and null-MX domains are `invalid` (score 0).

## Sample inputs
**Four quick examples**
```json
{"emails":["anna@gmail.com","info@apify.com","test@mailinator.com","bob@gmial.com"]}
```
**Paste a CSV column, syntax and typo check only (fastest)**
```json
{"emailsText":"a@acme.io, b@acme.io; c@foo.co","checkDns":false}
```
**Large list, more parallelism**
```json
{"emails":["..."],"concurrency":60}
```

## Price guide
Pay per event: $0.0006 per email checked. Rough cost by volume:

| Emails | Cost |
|---|---|
| 1,000 | $0.60 |
| 10,000 | $6.00 |
| 100,000 | $60.00 |

The Apify free plan includes monthly credit, enough to try it. Set a maximum charge per run in the run options to cap spend.

## FAQ
**How much does it cost?** $0.60 per 1,000 emails checked, billed per unique address. Duplicates in your input are skipped and free.

**Is it as accurate as SMTP verification?** No, and it says so. It catches typos, fake domains, throwaway and role addresses. It cannot confirm that a mailbox exists.

**Are my emails stored or shared?** The actor processes your list in your run only; results stay in your Apify dataset. DNS queries contain only the domain part.

**Why is a typo domain like `gmial.com` also "disposable"?** Some typo domains appear on the public disposable list. Either way the row is `risky` and `didYouMean` shows the fix.

**Can I schedule it or call it by API?** Yes. Use Apify schedules, the API, or Make, Zapier and n8n integrations.

**Is it legal?** The actor does not contact mail servers or recipients. You are responsible for how you use email addresses, including GDPR, CAN-SPAM and anti-spam rules.
