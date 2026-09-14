/**
 * Open-selected URL picker (mirrors public/js/app.js selectedHttpArticleUrls).
 */
function selectedHttpArticleUrls(list) {
    return (list || [])
        .filter((a) => a && a.selected !== false && /^https?:\/\//i.test(String(a.url || '')))
        .map((a) => a.url);
}

function openUrlsInNewTabs(urls, openFn) {
    let opened = 0;
    let blocked = 0;
    (urls || []).forEach((url) => {
        const win = openFn(url, '_blank');
        if (win) opened += 1;
        else blocked += 1;
    });
    return { opened, blocked };
}

const articles = [];
for (let i = 1; i <= 30; i += 1) {
    articles.push({ selected: true, url: `https://example.com/article-${i}` });
}
articles.push({ selected: false, url: 'https://example.com/unchecked' });
articles.push({ selected: true, url: 'not-a-url' });

const urls = selectedHttpArticleUrls(articles);
if (urls.length !== 30) {
    console.error(`expected 30 http selected urls, got ${urls.length}`);
    process.exit(1);
}

let calls = 0;
const firstOnly = (url) => {
    calls += 1;
    return calls === 1 ? { url } : null;
};
const blockedSim = openUrlsInNewTabs(urls, firstOnly);
if (blockedSim.opened !== 1 || blockedSim.blocked !== 29) {
    console.error('confirm-style blocker simulation failed', blockedSim);
    process.exit(1);
}

calls = 0;
const allowAll = () => {
    calls += 1;
    return { ok: true };
};
const all = openUrlsInNewTabs(urls, allowAll);
if (all.opened !== 30 || all.blocked !== 0 || calls !== 30) {
    console.error('allow-all simulation failed', all, calls);
    process.exit(1);
}

console.log(JSON.stringify({ ok: true, urls: urls.length, allowAllOpened: all.opened, blockedSim }, null, 2));
