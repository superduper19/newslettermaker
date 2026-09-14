require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { isNonArticleUrl } = require('../lib/youcom-search');
const { youComQueriesFromPrompt, parsePromptSearchIntent } = require('../lib/search-intent');

const prompt = 'Find 45 articles about cannabis, hemp and psychedelic topics published after September 7th, 2026 or after. Do not find articles that are advertisement or roundups. Do not find articles that are about laws that havent passed with governor or president approval';

function parseDate(s) {
    const m = String(s || '').match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
    if (!m) return null;
    return new Date(2000 + parseInt(m[3], 10), parseInt(m[1], 10) - 1, parseInt(m[2], 10));
}

async function main() {
    const intent = parsePromptSearchIntent(prompt);
    const queries = youComQueriesFromPrompt(prompt);
    console.log('intent', intent);
    console.log('you.com queries', queries.queries);

    const res = await fetch('http://localhost:5020/api/articles/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            prompt,
            newsletterName: 'Week 32',
            model: 'claude-opus-5',
            searchEngine: 'youcom',
        }),
    });
    const data = await res.json();
    if (!data.success) {
        console.error('SEARCH FAILED', data);
        process.exit(1);
    }
    const arts = data.articles || [];
    const topic = /cannabis|marijuana|hemp|cbd|thc|psychedelic|psilocybin|weed|ganja/i;
    const adRoundup = /roundup|quick hits|advertorial|sponsored|shop now|buy now|gummies for energy|listicle|top 10/i;
    const unpassed = /bill that|proposed bill|draft (bill|rules)|hasn.?t passed|awaiting (governor|president)|lottery/i;
    const since = new Date('2026-09-08T00:00:00');
    const urlSet = new Set();
    const titleSet = new Set();
    const issues = [];
    const counts = { dupUrl: 0, dupTitle: 0, junk: 0, homepage: 0, offTopic: 0, oldOrUndated: 0, ads: 0, bills: 0 };

    arts.forEach((a, i) => {
        const url = String(a.url || '').toLowerCase();
        const blob = `${a.title || ''} ${a.url || ''} ${a.description || ''}`;
        if (urlSet.has(url)) {
            counts.dupUrl += 1;
            issues.push({ i, kind: 'dup-url', title: a.title, url: a.url });
        }
        urlSet.add(url);
        const tk = String(a.title || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
        if (tk.length > 12) {
            if (titleSet.has(tk)) {
                counts.dupTitle += 1;
                issues.push({ i, kind: 'dup-title', title: a.title, url: a.url });
            }
            titleSet.add(tk);
        }
        if (isNonArticleUrl(a.url)) {
            counts.junk += 1;
            issues.push({ i, kind: 'junk-url', title: a.title, url: a.url });
        }
        try {
            const p = new URL(a.url);
            if (p.pathname === '/' || p.pathname === '') counts.homepage += 1;
        } catch (e) { /* ignore */ }
        if (!topic.test(blob)) {
            counts.offTopic += 1;
            issues.push({ i, kind: 'off-topic', title: a.title, url: a.url });
        }
        const d = parseDate(a.date);
        if (!d) counts.oldOrUndated += 1;
        else if (d < since) {
            counts.oldOrUndated += 1;
            issues.push({ i, kind: 'before-window', date: a.date, title: a.title, url: a.url });
        }
        if (adRoundup.test(blob)) {
            counts.ads += 1;
            issues.push({ i, kind: 'ad-roundup', title: a.title, url: a.url });
        }
        if (unpassed.test(blob)) {
            counts.bills += 1;
            issues.push({ i, kind: 'unpassed-law', title: a.title, url: a.url });
        }
    });

    const evalOut = {
        httpStatus: res.status,
        count: arts.length,
        requested: 45,
        searchEngine: data.searchEngine,
        dateWindow: data.dateWindow,
        duplicateCountFromApi: data.duplicateCount,
        uniqueUrls: urlSet.size,
        uniqueTitles: titleSet.size,
        ...counts,
        issues,
        sample: arts.map((a) => ({ title: a.title, url: a.url, date: a.date })),
    };
    fs.writeFileSync(path.join(__dirname, 'youcom-last-prompt-eval.json'), JSON.stringify(evalOut, null, 2));
    console.log(JSON.stringify({
        count: evalOut.count,
        uniqueUrls: evalOut.uniqueUrls,
        ...counts,
        dateWindow: evalOut.dateWindow,
        issueKinds: issues.reduce((m, x) => {
            m[x.kind] = (m[x.kind] || 0) + 1;
            return m;
        }, {}),
    }, null, 2));
    arts.forEach((a, i) => {
        console.log(String(i + 1).padStart(2), String(a.date || '').padEnd(8), String(a.title || '').slice(0, 95));
    });
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
