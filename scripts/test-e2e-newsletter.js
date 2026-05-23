/**
 * End-to-end newsletter test: load session, publish images to Purablis, generate HTML, save to DB.
 * Run: node scripts/test-e2e-newsletter.js [sessionName]
 * Default session: "E2E Test {date}"
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const http = require('http');

const port = process.env.PORT || 5020;
const sessionName = process.argv[2] || `E2E Test ${new Date().toISOString().slice(0, 10)}`;
const baseUrl = process.env.GODADDY_PUBLIC_BASE_URL || 'https://purablis.com/News-roundup/images';
const categories = ['MED', 'THC', 'CBD', 'INV'];
const OUT_DIR = path.join(__dirname, '..', 'test-output', 'e2e-newsletter');

function request(method, urlPath, body) {
    return new Promise((resolve, reject) => {
        const payload = body ? JSON.stringify(body) : null;
        const req = http.request({
            hostname: 'localhost',
            port,
            path: urlPath,
            method,
            headers: payload
                ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
                : {},
        }, (res) => {
            let data = '';
            res.on('data', (c) => { data += c; });
            res.on('end', () => {
                try {
                    resolve({ status: res.statusCode, json: JSON.parse(data) });
                } catch (e) {
                    resolve({ status: res.statusCode, json: { raw: data } });
                }
            });
        });
        req.on('error', reject);
        if (payload) req.write(payload);
        req.end();
    });
}

function isPurablis(url) {
    return url && String(url).includes('purablis.com');
}

function getArticleImageUrl(article) {
    return article.publishedImageUrl || article.image || article.originalImageUrl || '';
}

async function publishToPurablis(url, target = 'article') {
    const res = await request('POST', '/api/images/publish-to-purablis', { url, target });
    if (res.status === 200 && res.json.success && res.json.url) return res.json.url;
    throw new Error(res.json.error || `Publish failed (${res.status})`);
}

async function loadTemplate(category) {
    const res = await request('GET', `/api/newsletters/template/${category}`);
    if (res.status !== 200 || !res.json.html) throw new Error(`Template ${category}: ${res.json.error || res.status}`);
    return res.json.html;
}

function buildMinimalArticlesHtml(articles) {
    return articles.map((a) => {
        const img = getArticleImageUrl(a);
        const title = (a.title || 'Article').replace(/</g, '&lt;');
        const url = a.url || '#';
        return `<table><tr><td><a href="${url}"><img src="${img}" width="60" alt=""></a></td><td><a href="${url}">${title}</a></td></tr></table>`;
    }).join('\n');
}

function extractImgUrls(html) {
    const urls = [];
    const re = /src=["']([^"']+)["']/gi;
    let m;
    while ((m = re.exec(html))) urls.push(m[1]);
    return urls;
}

function analyzeHtml(html, label) {
    const imgs = extractImgUrls(html);
    const hostOf = (u) => {
        try {
            return new URL(u, 'https://purablis.com').hostname.toLowerCase();
        } catch (e) {
            return '';
        }
    };
    const external = imgs.filter((u) => {
        const h = hostOf(u);
        return h && !h.includes('purablis.com') && !u.startsWith('data:');
    });
    const freepik = imgs.filter((u) => hostOf(u).includes('freepik'));
    const supabase = imgs.filter((u) => hostOf(u).includes('supabase'));
    const purablis = imgs.filter((u) => isPurablis(u));
    return { label, total: imgs.length, purablis: purablis.length, freepik: freepik.length, supabase: supabase.length, external, imgs };
}

async function buildTestSessionFromTesting() {
    const sessRes = await request('GET', '/api/state?key=sessions');
    const sessions = sessRes.json.value || {};
    const source = sessions['Week 14'] || sessions['Week 14a'] || sessions.Testing || Object.values(sessions)[0];
    if (!source || !Array.isArray(source.articles) || !source.articles.length) {
        throw new Error('No suitable session with articles found in database');
    }
    return JSON.parse(JSON.stringify(source));
}

async function main() {
    console.log('=== E2E Newsletter Test ===\n');
    console.log('Server: http://localhost:' + port);
    console.log('Session name:', sessionName);

    const health = await request('GET', '/api/health');
    if (health.json.status !== 'ok') throw new Error('Server not healthy');

    fs.mkdirSync(OUT_DIR, { recursive: true });

    let session;
    try {
        session = await buildTestSessionFromTesting();
        console.log('Loaded base session from DB (Week 14 / Testing)\n');
    } catch (e) {
        console.log('Building minimal synthetic session...\n');
        session = {
            articles: categories.flatMap((cat, ci) => [1, 2].map((n) => ({
                title: `E2E ${cat} Article ${n}`,
                url: `https://example.com/${cat.toLowerCase()}-${n}`,
                status: 'Y',
                categories: [cat],
                ranks: { [cat]: n },
                useInNewsletter: { [cat]: true },
                image: 'https://httpbin.org/image/png',
                originalImageUrl: 'https://httpbin.org/image/png',
                publishedImageUrl: null,
            }))),
            newsletterContent: {
                MED: { result: 'E2E test summary for MED.\nLine two.' },
                THC: { result: 'E2E test summary for THC.' },
                CBD: { result: 'E2E test summary for CBD.' },
                INV: { result: 'E2E test summary for INV.' },
                templates: {},
                selectedGreeting: 'Have a great week!',
            },
            inspirationalImages: ['https://httpbin.org/image/png'],
        };
    }

    // --- Publish article images ---
    console.log('1) Publishing article images to Purablis...');
    let artOk = 0;
    let artFail = 0;
    for (const article of session.articles) {
        const src = article.originalImageUrl || article.image;
        const current = getArticleImageUrl(article);
        if (current && isPurablis(current)) {
            if (!article.publishedImageUrl) article.publishedImageUrl = current;
            artOk++;
            continue;
        }
        if (!src || src.startsWith('data:') || src.startsWith('blob:')) continue;
        if (isPurablis(src)) {
            article.publishedImageUrl = src;
            article.image = src;
            artOk++;
            continue;
        }
        try {
            const published = await publishToPurablis(src, 'article');
            article.publishedImageUrl = published;
            article.image = published;
            if (!article.originalImageUrl) article.originalImageUrl = src;
            artOk++;
            console.log('   ✓', (article.title || '').slice(0, 40), '→', published);
        } catch (err) {
            artFail++;
            console.log('   ✗', (article.title || '').slice(0, 40), err.message);
        }
    }
    console.log(`   Articles: ${artOk} on Purablis, ${artFail} failed\n`);

    // --- Publish inspirational ---
    console.log('2) Publishing inspirational image to Purablis...');
    let inspUrl = '';
    const rawInsp = Array.isArray(session.inspirationalImages)
        ? session.inspirationalImages[0]
        : session.inspirationalImages;
    if (rawInsp) {
        if (isPurablis(rawInsp)) {
            inspUrl = rawInsp;
            console.log('   ✓ Already on Purablis:', inspUrl);
        } else {
            try {
                inspUrl = await publishToPurablis(rawInsp, 'inspirational');
                session.inspirationalImages = [inspUrl];
                console.log('   ✓ Published:', inspUrl);
            } catch (err) {
                console.log('   ✗ Inspirational publish failed:', err.message);
            }
        }
    } else {
        try {
            inspUrl = await publishToPurablis('https://httpbin.org/image/png', 'inspirational');
            session.inspirationalImages = [inspUrl];
            console.log('   ✓ Default inspirational:', inspUrl);
        } catch (err) {
            console.log('   ✗', err.message);
        }
    }
    console.log('');

    // --- Generate newsletters ---
    console.log('3) Generating newsletter HTML (4 categories)...');
    const newsletters = {};
    const reports = [];

    for (const cat of categories) {
        let template = session.newsletterContent?.templates?.[cat];
        if (!template) {
            try {
                template = await loadTemplate(cat);
            } catch (e) {
                template = '';
            }
        }
        const resultText = session.newsletterContent?.[cat]?.result || `E2E summary for ${cat}.`;
        const catArticles = session.articles.filter(
            (a) => ['Y', 'YM', 'COOL FINDS'].includes(a.status)
                && a.categories
                && a.categories.includes(cat),
        );
        const articlesHtml = buildMinimalArticlesHtml(catArticles.slice(0, 4));

        let html = template;
        if (html) {
            html = html
                .replace(/\{\{SUMMARY\}\}/g, resultText)
                .replace(/\{\{ARTICLES_HTML\}\}/g, articlesHtml)
                .replace(/\{\{INSPIRATIONAL_IMAGE\}\}/g, inspUrl || '')
                .replace(/\{\{NEWSLETTER_NAME\}\}/g, sessionName);
        } else {
            html = `<!DOCTYPE html><html><body><h1>${sessionName} - ${cat}</h1>`
                + (inspUrl ? `<img src="${inspUrl}" alt="Header">` : '')
                + `<div>${resultText}</div>${articlesHtml}</body></html>`;
        }

        const outFile = path.join(OUT_DIR, `${sessionName.replace(/[^\w-]+/g, '-')}-${cat}.html`);
        fs.writeFileSync(outFile, html, 'utf8');

        const analysis = analyzeHtml(html, cat);
        reports.push(analysis);
        newsletters[cat] = {
            html,
            resultText,
            articles: catArticles,
            inspirationalImage: inspUrl,
        };
        console.log(`   ${cat}: ${analysis.total} images, ${analysis.purablis} purablis, ${analysis.freepik} freepik, ${analysis.supabase} supabase`);
        if (analysis.external.length) {
            console.log('      ⚠ non-purablis:', analysis.external.slice(0, 3).join(', '));
        }
    }
    console.log('');

    const generated = {
        meta: { name: sessionName, generatedAt: new Date().toISOString(), e2e: true },
        newsletters,
        inspirationalImages: session.inspirationalImages,
        articles: session.articles.filter((a) => ['Y', 'YM', 'COOL FINDS'].includes(a.status)),
    };

    fs.writeFileSync(
        path.join(OUT_DIR, `${sessionName.replace(/[^\w-]+/g, '-')}-manifest.json`),
        JSON.stringify(generated, null, 2),
        'utf8',
    );

    // --- Save session ---
    console.log('4) Saving session to Supabase...');
    const sessRes = await request('GET', '/api/state?key=sessions');
    const sessions = sessRes.json.value || {};
    sessions[sessionName] = {
        ...session,
        savedAt: new Date().toISOString(),
    };
    const saveSess = await request('POST', '/api/state', { key: 'sessions', value: sessions });
    console.log('   Sessions save:', saveSess.status === 200 ? '✓' : '✗', saveSess.json.error || '');

    // --- Save generated newsletter ---
    console.log('5) Saving generated newsletter to Supabase...');
    const saveNl = await request('POST', '/api/newsletters', { name: sessionName, generated });
    console.log('   Newsletter save:', saveNl.status === 200 && saveNl.json.ok ? '✓' : '✗', saveNl.json.error || saveNl.json.key || '');

    // --- Summary ---
    const totalFreepik = reports.reduce((s, r) => s + r.freepik, 0);
    const totalSupabase = reports.reduce((s, r) => s + r.supabase, 0);
    const totalPurablis = reports.reduce((s, r) => s + r.purablis, 0);

    console.log('\n=== Summary ===');
    console.log('Output folder:', OUT_DIR);
    console.log('Session:', sessionName);
    console.log(`Images in HTML: ${totalPurablis} purablis, ${totalFreepik} freepik, ${totalSupabase} supabase`);
    console.log(`Article FTP: ${artOk} ok, ${artFail} fail`);
    console.log('Inspirational:', inspUrl || '(none)');

    if (artFail > 0 || totalFreepik > 0) {
        console.log('\n⚠ Some images may still depend on external hosts.');
        process.exit(1);
    }
    if (!inspUrl || !isPurablis(inspUrl)) {
        console.log('\n⚠ Inspirational image not on Purablis.');
        process.exit(1);
    }
    console.log('\n✓ E2E newsletter test passed.');
}

main().catch((e) => {
    console.error('\n✗ E2E failed:', e.message);
    process.exit(1);
});
