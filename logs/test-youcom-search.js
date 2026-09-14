/**
 * Live You.com search check. Writes a summary to logs/youcom-search-test.json
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { flattenYouComArticles, searchYouComMany, isNonArticleUrl } = require('../lib/youcom-search');

function assert(name, cond) {
    if (!cond) throw new Error('FAIL: ' + name);
    console.log('ok', name);
}

async function main() {
    const nested = {
        results: {
            news: [
                { title: 'Real news', url: 'https://mjbizdaily.com/news/foo/', page_age: '2026-09-10T12:00:00', description: 'x' },
                { title: 'Old news', url: 'https://mjbizdaily.com/news/old/', page_age: '2022-03-10T12:00:00', description: 'x' },
                { title: 'Video', url: 'https://www.pbs.org/video/nj-cannabis-2022/', page_age: '2026-09-10T12:00:00', description: 'x' },
            ],
            web: [
                { title: 'Homepage', url: 'https://mjbizdaily.com/', page_age: '2026-09-10T12:00:00', description: 'x' },
                { title: 'Hub', url: 'https://apnews.com/hub/marijuana', page_age: '2026-09-10T12:00:00', description: 'x' },
                { title: 'Also real', url: 'https://ganjapreneur.com/story/', page_age: '2026-09-11T12:00:00', description: 'x' },
            ],
        },
        related: [{ title: 'Trap', url: 'https://example.com/not-cannabis', description: 'should not be collected' }],
    };
    const flat = flattenYouComArticles(nested, { sinceISO: '2026-09-08', untilISO: '2026-09-13' });
    assert('no homepage', !flat.some((a) => a.url === 'https://mjbizdaily.com/'));
    assert('no hub', !flat.some((a) => a.url.includes('/hub/')));
    assert('no video', !flat.some((a) => a.url.includes('/video/')));
    assert('no nested trap', !flat.some((a) => a.url.includes('example.com')));
    assert('no old date', !flat.some((a) => a.url.includes('/old/')));
    assert('keeps real news', flat.some((a) => a.url.includes('/news/foo/')));
    assert('keeps ganjapreneur', flat.some((a) => a.url.includes('ganjapreneur.com')));
    assert('junk helpers', isNonArticleUrl('https://mjbizdaily.com/') && isNonArticleUrl('https://www.pbs.org/video/x'));

    const live = await searchYouComMany(['cannabis news'], {
        count: 15,
        minResults: 20,
        freshness: '2026-09-08to2026-09-13',
        sinceISO: '2026-09-08',
        untilISO: '2026-09-13',
    });
    const hosts = {};
    live.articles.forEach((a) => {
        try { hosts[new URL(a.url).host] = (hosts[new URL(a.url).host] || 0) + 1; } catch (e) { /* ignore */ }
    });
    const junk = live.articles.filter((a) => isNonArticleUrl(a.url));
    assert('live under 50', live.articles.length > 0 && live.articles.length <= 50);
    assert('live no junk urls', junk.length === 0);
    const out = {
        count: live.articles.length,
        hosts,
        titles: live.articles.map((a) => ({ title: a.title, url: a.url, date: a.date })),
    };
    const outPath = path.join(__dirname, 'youcom-search-test.json');
    fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
    console.log('wrote', outPath, 'count', out.count);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
