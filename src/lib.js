import { readFileSync } from 'node:fs';
import { domainToASCII } from 'node:url';

export const DISPOSABLE = new Set(
    readFileSync(new URL('./data/disposable.txt', import.meta.url), 'utf8')
        .split('\n').map((s) => s.trim().toLowerCase()).filter((s) => s && !s.startsWith('#')),
);

export const ROLE_LOCALS = new Set([
    'admin', 'administrator', 'info', 'contact', 'support', 'help', 'sales', 'hello', 'office', 'team', 'mail', 'marketing',
    'billing', 'accounts', 'accounting', 'finance', 'hr', 'jobs', 'careers', 'press', 'media', 'abuse', 'postmaster',
    'webmaster', 'hostmaster', 'noreply', 'no-reply', 'donotreply', 'do-not-reply', 'service', 'enquiries', 'enquiry',
    'feedback', 'privacy', 'legal', 'security', 'orders', 'booking', 'bookings', 'reception', 'newsletter', 'root',
]);

export const FREE_DOMAINS = new Set([
    'gmail.com', 'googlemail.com', 'yahoo.com', 'yahoo.co.uk', 'yahoo.fr', 'yahoo.de', 'yahoo.co.jp', 'ymail.com',
    'hotmail.com', 'hotmail.co.uk', 'hotmail.fr', 'outlook.com', 'live.com', 'msn.com', 'icloud.com', 'me.com', 'mac.com',
    'aol.com', 'proton.me', 'protonmail.com', 'pm.me', 'gmx.com', 'gmx.de', 'gmx.net', 'web.de', 'mail.com', 'zoho.com',
    'yandex.com', 'yandex.ru', 'mail.ru', 'qq.com', '163.com', '126.com', 'naver.com', 'daum.net', 'libero.it', 'orange.fr',
    'free.fr', 'laposte.net', 't-online.de', 'comcast.net', 'verizon.net', 'att.net', 'sbcglobal.net', 'btinternet.com',
    'fastmail.com', 'tutanota.com', 'tuta.io', 'hey.com',
]);

const COMMON_TARGETS = [
    'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com', 'aol.com', 'live.com', 'msn.com', 'proton.me',
    'protonmail.com', 'gmx.com', 'yandex.com', 'mail.com', 'me.com', 'googlemail.com', 'hotmail.co.uk', 'yahoo.co.uk',
];

const TLD_TYPOS = { con: 'com', cmo: 'com', vom: 'com', xom: 'com', comm: 'com', cim: 'com', ney: 'net', met: 'net', ogr: 'org', rog: 'org' };

const MX_PROVIDERS = [
    [/(^|\.)(google\.com|googlemail\.com)$/, 'Google Workspace / Gmail'],
    [/(^|\.)(outlook\.com|protection\.outlook\.com|hotmail\.com)$/, 'Microsoft 365 / Outlook'],
    [/(^|\.)(pphosted\.com|ppe-hosted\.com)$/, 'Proofpoint'],
    [/(^|\.)(mimecast\.com|mimecast-offshore\.com)$/, 'Mimecast'],
    [/(^|\.)(zoho\.com|zoho\.eu|zoho\.in)$/, 'Zoho Mail'],
    [/(^|\.)(yahoodns\.net|yahoo\.com)$/, 'Yahoo'],
    [/(^|\.)(protonmail\.ch|proton\.me)$/, 'Proton'],
    [/(^|\.)(icloud\.com|me\.com)$/, 'iCloud'],
    [/(^|\.)(secureserver\.net)$/, 'GoDaddy'],
    [/(^|\.)(mailgun\.org)$/, 'Mailgun'],
    [/(^|\.)(messagingengine\.com)$/, 'Fastmail'],
    [/(^|\.)(yandex\.net|yandex\.ru)$/, 'Yandex'],
    [/(^|\.)(barracudanetworks\.com|cudasvc\.com)$/, 'Barracuda'],
    [/(^|\.)(ovh\.net)$/, 'OVH'],
    [/(^|\.)(ionos\.com|1and1\.com|kundenserver\.de)$/, 'IONOS'],
    [/(^|\.)(registrar-servers\.com|privateemail\.com)$/, 'Namecheap'],
];

export function splitEmail(raw) {
    let s = String(raw ?? '').trim();
    const angle = s.match(/<([^<>]+)>\s*$/);
    if (angle) s = angle[1].trim();
    s = s.replace(/^mailto:/i, '').replace(/^["'\s]+|["'\s,;]+$/g, '');
    return s;
}

const LOCAL_RE = /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+(\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*$/;

export function parseSyntax(raw) {
    const cleaned = splitEmail(raw);
    if (!cleaned) return { ok: false, reason: 'empty', cleaned };
    const at = cleaned.lastIndexOf('@');
    if (at < 1 || at === cleaned.length - 1) return { ok: false, reason: 'missing_at_or_parts', cleaned };
    const local = cleaned.slice(0, at);
    const asciiDomain = domainToASCII(cleaned.slice(at + 1).toLowerCase());
    if (!asciiDomain) return { ok: false, reason: 'bad_domain', cleaned, local };
    if (local.length > 64) return { ok: false, reason: 'local_too_long', cleaned, local, domain: asciiDomain };
    if (local.length + 1 + asciiDomain.length > 254) return { ok: false, reason: 'too_long', cleaned, local, domain: asciiDomain };
    if (!LOCAL_RE.test(local)) return { ok: false, reason: 'bad_local_part', cleaned, local, domain: asciiDomain };
    const labels = asciiDomain.split('.');
    if (labels.length < 2) return { ok: false, reason: 'domain_without_tld', cleaned, local, domain: asciiDomain };
    for (const l of labels) {
        if (!/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/.test(l)) return { ok: false, reason: 'bad_domain', cleaned, local, domain: asciiDomain };
    }
    const tld = labels[labels.length - 1];
    if (!/^([a-z]{2,63}|xn--[a-z0-9-]{1,59})$/.test(tld)) return { ok: false, reason: 'bad_tld', cleaned, local, domain: asciiDomain };
    return { ok: true, local, domain: asciiDomain, cleaned: `${local}@${asciiDomain}` };
}

export function levenshtein(a, b) {
    const m = a.length;
    const n = b.length;
    let prev = Array.from({ length: n + 1 }, (_, j) => j);
    for (let i = 1; i <= m; i++) {
        const cur = [i];
        for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        prev = cur;
    }
    return prev[n];
}

export function suggestDomain(domain) {
    if (COMMON_TARGETS.includes(domain)) return null;
    for (const t of COMMON_TARGETS) {
        const d = levenshtein(domain, t);
        if (d === 1 || (d === 2 && t.length >= 9 && domain.length >= 9)) return t;
    }
    const i = domain.lastIndexOf('.');
    const fixed = TLD_TYPOS[domain.slice(i + 1)];
    if (fixed) {
        const cand = `${domain.slice(0, i)}.${fixed}`;
        if (FREE_DOMAINS.has(cand) || COMMON_TARGETS.includes(cand)) return cand;
    }
    return null;
}

export function isDisposable(domain) {
    const labels = domain.split('.');
    for (let i = 0; i < labels.length - 1; i++) if (DISPOSABLE.has(labels.slice(i).join('.'))) return true;
    return false;
}

export function isRoleLocal(local) {
    return ROLE_LOCALS.has(local.toLowerCase().replace(/[+].*$/, ''));
}

export function mxProvider(hosts) {
    for (const h of hosts) for (const [re, name] of MX_PROVIDERS) if (re.test(h)) return name;
    return null;
}

const NO_RECORD = new Set(['ENODATA', 'ENOTFOUND', 'NODATA', 'NXDOMAIN']);

export async function lookupMail(domain, resolver) {
    let mx;
    try {
        mx = await resolver.resolveMx(domain);
    } catch (err) {
        if (!NO_RECORD.has(err.code)) return { status: 'error', error: err.code || err.message, mxHosts: [] };
        mx = [];
    }
    if (mx.length === 1 && (mx[0].exchange === '' || mx[0].exchange === '.')) return { status: 'null_mx', mxHosts: [] };
    if (mx.length) {
        const hosts = mx.sort((a, b) => a.priority - b.priority).map((r) => r.exchange.toLowerCase().replace(/\.$/, ''));
        return { status: 'mx', mxHosts: hosts };
    }
    for (const fn of ['resolve4', 'resolve6']) {
        try {
            const addrs = await resolver[fn](domain);
            if (addrs.length) return { status: 'implicit_mx', mxHosts: [] };
        } catch (err) {
            if (!NO_RECORD.has(err.code)) return { status: 'error', error: err.code || err.message, mxHosts: [] };
        }
    }
    return { status: 'no_domain', mxHosts: [] };
}

export function evaluate(syntax, dns) {
    const base = { email: syntax.cleaned };
    if (!syntax.ok) return { ...base, result: 'invalid', score: 0, reasons: [`syntax:${syntax.reason}`] };
    const { local, domain } = syntax;
    const disposable = isDisposable(domain);
    const role = isRoleLocal(local);
    const free = FREE_DOMAINS.has(domain);
    const suggestion = suggestDomain(domain);
    const reasons = [];
    let score = 100;
    let result = 'ok';
    if (dns) {
        if (dns.status === 'no_domain') { result = 'invalid'; score = 0; reasons.push('domain_does_not_exist'); }
        else if (dns.status === 'null_mx') { result = 'invalid'; score = 0; reasons.push('domain_rejects_email'); }
        else if (dns.status === 'implicit_mx') { score -= 25; reasons.push('no_mx_record_uses_a_record'); }
        else if (dns.status === 'error') { score -= 30; reasons.push(`dns_error:${dns.error}`); }
    }
    if (result !== 'invalid') {
        if (disposable) { score -= 70; reasons.push('disposable_domain'); }
        if (suggestion) { score -= 45; reasons.push(`possible_typo:${suggestion}`); }
        if (role) { score -= 20; reasons.push('role_address'); }
        if (local.length > 40) { score -= 10; reasons.push('very_long_local_part'); }
        score = Math.max(score, 0);
        if (score < 80) result = 'risky';
    }
    return {
        ...base,
        result,
        score,
        reasons,
        local,
        domain,
        isDisposable: disposable,
        isRole: role,
        isFreeProvider: free,
        didYouMean: suggestion ? `${local}@${suggestion}` : null,
        mxHosts: dns?.mxHosts ?? null,
        mailProvider: dns ? mxProvider(dns.mxHosts) : null,
    };
}
