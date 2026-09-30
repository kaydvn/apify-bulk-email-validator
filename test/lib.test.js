import test from 'node:test';
import assert from 'node:assert/strict';
import { DISPOSABLE, evaluate, isDisposable, levenshtein, lookupMail, mxProvider, parseSyntax, suggestDomain } from '../src/lib.js';

const dnsErr = (code) => Object.assign(new Error(code), { code });
const fake = (table) => ({
    resolveMx: async (d) => { const t = table[d]; if (t?.mx) return t.mx; throw dnsErr(t?.mxErr || 'ENODATA'); },
    resolve4: async (d) => { const t = table[d]; if (t?.a) return t.a; throw dnsErr(t?.aErr || 'ENODATA'); },
    resolve6: async () => { throw dnsErr('ENODATA'); },
});

test('syntax accepts normal and tagged addresses', () => {
    assert.equal(parseSyntax('John.Doe+news@Example.COM').cleaned, 'John.Doe+news@example.com');
    assert.equal(parseSyntax('Jane <jane@acme.io>').cleaned, 'jane@acme.io');
    assert.equal(parseSyntax('mailto:a@b.co,').ok, true);
});

test('syntax rejects malformed addresses', () => {
    for (const bad of ['', 'plain', 'a@', '@b.com', 'a..b@c.com', '.a@c.com', 'a b@c.com', 'a@b', 'a@-b.com', 'a@b.c', 'a@b.123']) {
        assert.equal(parseSyntax(bad).ok, false, bad);
    }
    assert.equal(parseSyntax(`${'x'.repeat(65)}@a.com`).reason, 'local_too_long');
});

test('IDN domains are converted to punycode', () => {
    assert.equal(parseSyntax('user@bücher.de').domain, 'xn--bcher-kva.de');
});

test('disposable list is loaded and matches subdomains', () => {
    assert.ok(DISPOSABLE.size > 5000);
    assert.equal(isDisposable('mailinator.com'), true);
    assert.equal(isDisposable('x.mailinator.com'), true);
    assert.equal(isDisposable('gmail.com'), false);
});

test('typo suggestions', () => {
    assert.equal(suggestDomain('gmial.com'), 'gmail.com');
    assert.equal(suggestDomain('hotmail.con'), 'hotmail.com');
    assert.equal(suggestDomain('gmail.com'), null);
    assert.equal(suggestDomain('acme.io'), null);
    assert.equal(levenshtein('kitten', 'sitting'), 3);
});

test('mail provider detection', () => {
    assert.equal(mxProvider(['aspmx.l.google.com']), 'Google Workspace / Gmail');
    assert.equal(mxProvider(['acme-com.mail.protection.outlook.com']), 'Microsoft 365 / Outlook');
    assert.equal(mxProvider(['mail.unknown.example']), null);
});

test('lookupMail covers mx, implicit mx, null mx, missing and error', async () => {
    const r = fake({
        'a.com': { mx: [{ exchange: 'b.a.com.', priority: 20 }, { exchange: 'a.a.com', priority: 10 }] },
        'b.com': { a: ['1.2.3.4'] },
        'c.com': { mx: [{ exchange: '', priority: 0 }] },
        'd.com': { mxErr: 'ENOTFOUND', aErr: 'ENOTFOUND' },
        'e.com': { mxErr: 'ESERVFAIL' },
    });
    assert.deepEqual(await lookupMail('a.com', r), { status: 'mx', mxHosts: ['a.a.com', 'b.a.com'] });
    assert.equal((await lookupMail('b.com', r)).status, 'implicit_mx');
    assert.equal((await lookupMail('c.com', r)).status, 'null_mx');
    assert.equal((await lookupMail('d.com', r)).status, 'no_domain');
    assert.equal((await lookupMail('e.com', r)).status, 'error');
});

test('evaluate classifies', () => {
    const mx = { status: 'mx', mxHosts: ['aspmx.l.google.com'] };
    const good = evaluate(parseSyntax('anna@acme.com'), mx);
    assert.equal(good.result, 'ok');
    assert.equal(good.mailProvider, 'Google Workspace / Gmail');
    assert.equal(evaluate(parseSyntax('info@acme.com'), mx).result, 'ok');
    const role = evaluate(parseSyntax('admin@acme.com'), mx);
    assert.ok(role.isRole && role.score === 80);
    const disp = evaluate(parseSyntax('x@mailinator.com'), mx);
    assert.equal(disp.result, 'risky');
    assert.ok(disp.reasons.includes('disposable_domain'));
    const typo = evaluate(parseSyntax('x@gmial.com'), mx);
    assert.equal(typo.didYouMean, 'x@gmail.com');
    assert.equal(typo.result, 'risky');
    assert.equal(evaluate(parseSyntax('x@nodomain.test'), { status: 'no_domain', mxHosts: [] }).result, 'invalid');
    assert.equal(evaluate(parseSyntax('x@a.com'), { status: 'null_mx', mxHosts: [] }).result, 'invalid');
    assert.equal(evaluate(parseSyntax('bad@@x'), null).result, 'invalid');
    assert.equal(evaluate(parseSyntax('x@acme.com'), { status: 'error', error: 'ETIMEOUT', mxHosts: [] }).result, 'risky');
    assert.equal(evaluate(parseSyntax('x@acme.com'), null).mxHosts, null);
});
