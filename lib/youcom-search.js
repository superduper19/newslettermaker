/**
 * You.com Web Search API — Phase 1 article discovery for Newsletter Maker.
 * @see https://you.com/docs/api-reference/search/v1-search
 */

const YOU_COM_SEARCH_URLS = [
    'https://ydc-index.io/v1/search',
    'https://api.you.com/v1/search',
];
const {
    parseBoostDomains,
    parseExcludeDomains,
    parseIncludeDomains,
} = require('./article-source-domains');
const { isCannabisServiceHost } = require('../public/js/story-groups');
const { dedupeArticleList } = require('./article-dedup');

function cleanKey(key) {
    return String(key || '').replace(/^["']|["']$/g, '').trim();
}

function getYouComApiKey() {
    return cleanKey(process.env.YDC_API_KEY) || cleanKey(process.env['You.com_API']);
}

function formatPageAge(pageAge) {
    if (!pageAge) return '';
    const d = new Date(pageAge);
    if (Number.isNaN(d.getTime())) return String(pageAge);
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const yy = String(d.getFullYear()).slice(-2);
    return `${mm}/${dd}/${yy}`;
}

function formatResultBlock(result, sectionLabel) {
    const snippets = Array.isArray(result.snippets) ? result.snippets.join(' ') : '';
    const highlights = result.contents?.highlights
        ? (Array.isArray(result.contents.highlights)
            ? result.contents.highlights.join(' ')
            : String(result.contents.highlights))
        : '';
    const extra = highlights || snippets;
    const lines = [
        `Section: ${sectionLabel}`,
        `Title: ${result.title || 'Untitled'}`,
        `URL: ${result.url || ''}`,
        `Date: ${formatPageAge(result.page_age)}`,
    ];
    if (result.description) lines.push(`Description: ${result.description}`);
    if (extra) lines.push(`Excerpt: ${extra}`);
    return lines.join('\n');
}

function sectionResults(data) {
    const news = Array.isArray(data?.results?.news) ? data.results.news : [];
    const web = Array.isArray(data?.results?.web) ? data.results.web : [];
    return { news, web };
}

function isNonArticleUrl(url) {
    const raw = String(url || '').trim();
    if (!raw.startsWith('http')) return true;
    const lower = raw.toLowerCase();
    if (/youtube\.com|youtu\.be|vimeo\.com|\/video\//.test(lower)) return true;
    try {
        const parsed = new URL(raw);
        const path = parsed.pathname.replace(/\/+$/, '') || '/';
        if (path === '/') return true;
        if (/^\/(hub|topic|topics|category|tag|tags|page|podcasts)(\/|$)/i.test(path)) return true;
        if (/\/(archives?|podcasts|strains-products)\//i.test(path)) return true;
        if (/\/page\/\d+/i.test(path)) return true;
    } catch (e) {
        return true;
    }
    return false;
}

function isOutsideDateWindow(pageAge, sinceISO, untilISO) {
    if (!pageAge || (!sinceISO && !untilISO)) return false;
    const d = new Date(pageAge);
    if (Number.isNaN(d.getTime())) return false;
    if (sinceISO) {
        const since = new Date(`${sinceISO}T00:00:00`);
        if (d < since) return true;
    }
    if (untilISO) {
        const until = new Date(`${untilISO}T23:59:59`);
        if (d > until) return true;
    }
    return false;
}

function flattenYouComArticles(data, options = {}) {
    const { news, web } = sectionResults(data);
    const seen = new Set();
    const articles = [];
    const sinceISO = options.sinceISO || '';
    const untilISO = options.untilISO || '';
    for (const result of [...news, ...web]) {
        const url = String(result?.url || '').trim();
        if (!url || seen.has(url) || isNonArticleUrl(url) || isCannabisServiceHost(url)) continue;
        if (isOutsideDateWindow(result.page_age, sinceISO, untilISO)) continue;
        seen.add(url);
        articles.push({
            title: result.title || 'Untitled',
            url,
            description: result.description || (Array.isArray(result.snippets) ? result.snippets.join(' ') : ''),
            date: formatPageAge(result.page_age),
        });
    }
    return articles;
}

function formatYouComResultsAsText(data) {
    const web = data?.results?.web || [];
    const news = data?.results?.news || [];
    const blocks = [];
    news.forEach((r) => blocks.push(formatResultBlock(r, 'news')));
    web.forEach((r) => blocks.push(formatResultBlock(r, 'web')));
    if (!blocks.length) {
        return 'No web or news results were returned for this query.';
    }
    return blocks.join('\n\n---\n\n');
}

/**
 * @param {string} query - User search prompt
 * @param {object} [options]
 * @param {string} [options.freshness] - day|week|month|year
 * @param {number} [options.count] - per section (web + news)
 */
async function searchYouCom(query, options = {}) {
    const apiKey = getYouComApiKey();
    if (!apiKey) {
        const err = new Error(
            'YDC_API_KEY is not configured on the server. Add your You.com API key to .env (or Vercel env vars) and restart.',
        );
        err.code = 'youcom_not_configured';
        throw err;
    }

    const count = parseInt(
        options.count || process.env.YOUCOM_SEARCH_COUNT || '25',
        10,
    );
    const freshness = options.freshness || process.env.YOUCOM_FRESHNESS || 'week';
    const offset = Math.min(Math.max(parseInt(options.offset || 0, 10) || 0, 0), 9);
    const includeDomains = parseIncludeDomains();

    const body = {
        query: String(query || '').trim(),
        count: Math.min(Math.max(count, 1), 100),
        freshness,
        offset,
        country: process.env.YOUCOM_COUNTRY || 'US',
        language: process.env.YOUCOM_LANGUAGE || 'EN',
    };

    // include_domains = strict allowlist (news-only from your list).
    // boost_domains + exclude_domains = prefer your sites but still allow other publishers.
    if (includeDomains.length) {
        body.include_domains = includeDomains;
    } else {
        body.boost_domains = parseBoostDomains();
        const excludeDomains = parseExcludeDomains();
        if (excludeDomains.length) {
            body.exclude_domains = excludeDomains;
        }
    }

    const fetch = (await import('node-fetch')).default;
    let data = {};
    let res = null;
    let lastErr = null;
    for (const endpoint of YOU_COM_SEARCH_URLS) {
        res = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': apiKey,
            },
            body: JSON.stringify(body),
        });
        data = await res.json().catch(() => ({}));
        if (res.ok) break;
        lastErr = data?.message || data?.error || res.statusText || `HTTP ${res.status}`;
        if (res.status !== 404) break;
    }
    if (!res || !res.ok) {
        const err = new Error(`You.com search failed: ${lastErr || 'unknown error'}`);
        err.status = res ? res.status : 500;
        throw err;
    }

    const webCount = (data?.results?.web || []).length;
    const newsCount = (data?.results?.news || []).length;
    const articles = flattenYouComArticles(data, {
        sinceISO: options.sinceISO,
        untilISO: options.untilISO,
    });
    const mode = includeDomains.length ? `include:${includeDomains.length}` : `boost:${(body.boost_domains || []).length},exclude:${(body.exclude_domains || []).length}`;

    if (articles.length < 5) {
        console.log('You.com sparse response keys:', Object.keys(data || {}), 'results keys:', data?.results ? Object.keys(data.results) : [], 'count param', body.count, 'offset', body.offset);
    }

    return {
        rawText: formatYouComResultsAsText(data),
        articles,
        webCount,
        newsCount,
        totalCount: articles.length,
        metadata: { ...(data?.metadata || {}), domainFilterMode: mode },
    };
}

async function searchYouComMany(queries, options = {}) {
    const minResults = Math.min(Math.max(parseInt(options.minResults || 40, 10) || 40, 1), 50);
    const count = Math.min(Math.max(parseInt(options.count || 20, 10) || 20, 1), 25);
    const freshness = options.freshness;
    const sinceISO = options.sinceISO || '';
    const untilISO = options.untilISO || '';
    const seen = new Set();
    const articles = [];
    const list = Array.isArray(queries) ? queries.filter(Boolean) : [queries];

    for (const query of list) {
        for (let offset = 0; offset <= 3 && articles.length < minResults; offset++) {
            const page = await searchYouCom(query, { count, freshness, offset, sinceISO, untilISO });
            let added = 0;
            for (const article of page.articles || []) {
                if (articles.length >= minResults) break;
                if (!article.url || seen.has(article.url) || isNonArticleUrl(article.url) || isCannabisServiceHost(article.url)) continue;
                seen.add(article.url);
                articles.push(article);
                added++;
            }
            if (added === 0) break;
        }
        if (articles.length >= minResults) break;
    }

    const { articles: unique, skipped } = dedupeArticleList(articles);
    if (skipped) console.log(`You.com title/URL dedupe removed ${skipped} duplicate(s).`);

    return {
        articles: unique,
        rawText: unique.map((a) => `Title: ${a.title}\nURL: ${a.url}\nDate: ${a.date}\nDescription: ${a.description}`).join('\n\n---\n\n'),
        totalCount: unique.length,
    };
}

module.exports = {
    getYouComApiKey,
    searchYouCom,
    searchYouComMany,
    flattenYouComArticles,
    formatYouComResultsAsText,
    isNonArticleUrl,
};
