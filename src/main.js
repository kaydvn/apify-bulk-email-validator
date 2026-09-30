import { Actor, log } from 'apify';
import { promises as dns } from 'node:dns';
import { evaluate, lookupMail, parseSyntax } from './lib.js';

const EVENT = 'email';

await Actor.init();
const input = (await Actor.getInput()) || {};
const raw = [...(input.emails || [])];
if (typeof input.emailsText === 'string') raw.push(...input.emailsText.split(/[\s,;]+/));
const checkDns = input.checkDns !== false;
const concurrency = Math.min(Math.max(Number(input.concurrency) || 25, 1), 100);
if (!raw.filter((e) => String(e).trim()).length) throw new Error('Give at least one email address in "emails" or "emailsText".');

const resolver = new dns.Resolver({ timeout: 4000, tries: 2 });
const domainCache = new Map();
const lookup = (domain) => {
    if (!domainCache.has(domain)) domainCache.set(domain, lookupMail(domain, resolver));
    return domainCache.get(domain);
};

const seen = new Set();
const jobs = [];
let duplicates = 0;
for (const r of raw) {
    const syntax = parseSyntax(r);
    const key = syntax.cleaned.toLowerCase();
    if (!key) continue;
    if (seen.has(key)) { duplicates++; continue; }
    seen.add(key);
    jobs.push(syntax);
}
log.info(`${jobs.length} unique emails (${duplicates} duplicates skipped), DNS check ${checkDns ? 'on' : 'off'}`);

const counts = { ok: 0, risky: 0, invalid: 0 };
let done = 0;
let limitReached = false;
let next = 0;
async function worker() {
    while (next < jobs.length && !limitReached) {
        const syntax = jobs[next++];
        const d = syntax.ok && checkDns ? await lookup(syntax.domain) : null;
        const row = evaluate(syntax, d);
        counts[row.result]++;
        const charge = await Actor.pushData(row, EVENT);
        if (charge?.eventChargeLimitReached) limitReached = true;
        if (++done % 500 === 0) await Actor.setStatusMessage(`Checked ${done}/${jobs.length}`);
    }
}
await Promise.all(Array.from({ length: concurrency }, worker));

await Actor.setValue('SUMMARY', { checked: done, duplicatesSkipped: duplicates, ...counts, stoppedAtChargeLimit: limitReached });
if (limitReached) log.info('Stopped at the maximum charge set for this run.');
await Actor.setStatusMessage(`Finished: ${counts.ok} ok, ${counts.risky} risky, ${counts.invalid} invalid`, { isStatusMessageTerminal: true });
await Actor.exit();
