/**
 * Export newsletter images for manual GoDaddy upload.
 * Run: node scripts/export-session-images.js "Week 16C"
 *
 * Creates:
 *   export/<session>/articles-and-inspirational/  — article icons + inspirational
 *   export/<session>/states/                      — state PNGs (original names)
 *   export/<session>/manifest.json                — mapping for re-import
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const { matchStateIcons } = require('../lib/state-icons');
const { applyEditionDatePrefix, editionDatePrefix } = require('../lib/purablis-public-url');

const TABLE = process.env.SUPABASE_STATE_TABLE || 'newsletter_state';
const CATEGORIES = ['MED', 'THC', 'CBD', 'INV'];
const STATE_ICONS_DIR = path.join(__dirname, '..', 'public', 'state_icons_dark');
const OUT_ROOT = path.join(__dirname, '..', 'export');

function slugifyTitle(title, maxLen = 48) {
    return String(title || 'article')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, maxLen) || 'article';
}

function inferBaseFilename(url) {
    const u = String(url || '').trim();
    if (!u) return '';
    const m = u.match(/\/([^/?#]+\.(?:png|jpe?g|gif|webp|svg))(?:\?|#|$)/i);
    if (!m) return '';
    let base = m[1];
    if (/freepik|cdn-icons/i.test(u) && !/^freepik-/i.test(base)) {
        const id = u.match(/(\d{4,})/);
        if (id) base = `freepik-${id[1]}${path.extname(base) || '.png'}`;
    }
    if (/\/uploads\//i.test(u) && !/^upload-/i.test(base)) {
        base = `upload-${base}`;
    }
    return base;
}

function articleUsedInNewsletter(article) {
    if (['Y', 'YM', 'COOL FINDS'].includes(article.status)) return true;
    for (const cat of CATEGORIES) {
        const r = article.ranks && article.ranks[cat];
        if (r && /^(Y|YM|\d+|COOL FINDS)/i.test(String(r))) return true;
    }
    return false;
}

function getArticleCategories(article) {
    const out = [];
    for (const cat of CATEGORIES) {
        const r = article.ranks && article.ranks[cat];
        if (r && /^(Y|YM|\d+|COOL FINDS)/i.test(String(r))) {
            out.push({ cat, rank: String(r) });
        }
    }
    if (!out.length && article.status) {
        out.push({ cat: 'ALL', rank: article.status });
    }
    return out;
}

function pickImageUrl(article) {
    for (const field of ['publishedImageUrl', 'image', 'originalImageUrl', 'uploadedImageUrl']) {
        const v = article[field];
        if (v && String(v).trim() && !/^\/api\/images\/asset\//i.test(v)) {
            return String(v).trim();
        }
    }
    return '';
}

function buildArticleExportName(article, datePrefix) {
    const base = inferBaseFilename(pickImageUrl(article)) || `${slugifyTitle(article.title)}.png`;
    const cats = getArticleCategories(article);
    const primary = cats[0] || { cat: 'ART', rank: '0' };
    const slug = slugifyTitle(article.title, 36);
    const ext = path.extname(base) || '.png';
    const core = path.basename(base, ext);
    const labeled = `${primary.cat}-${primary.rank}-${slug}-${core}${ext}`.replace(/--+/g, '-');
    return applyEditionDatePrefix(labeled, datePrefix);
}

async function downloadToFile(url, destPath) {
    const fetch = (await import('node-fetch')).default;
    const res = await fetch(url, {
        redirect: 'follow',
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; NewsletterMaker/1.0)' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(destPath, buf);
    return buf.length;
}

async function downloadFromFtpImages(filename, destPath) {
    const host = process.env.GODADDY_FTP_HOST;
    const user = process.env.GODADDY_FTP_USER;
    const password = process.env.GODADDY_FTP_PASS;
    if (!host || !user || !password) throw new Error('FTP not configured');

    const { Client } = require('basic-ftp');
    const client = new Client();
    await client.access({
        host,
        port: parseInt(process.env.GODADDY_FTP_PORT || '21', 10),
        user,
        password,
        secure: true,
        secureOptions: { rejectUnauthorized: false },
    });
    try {
        await client.cd('images');
        await client.downloadTo(destPath, filename);
    } finally {
        client.close();
    }
    return fs.statSync(destPath).size;
}

async function resolveImageBytes(url, destPath) {
    const u = String(url || '').trim();
    const base = inferBaseFilename(u);

    if (u.startsWith('/state_icons_dark/')) {
        const local = path.join(__dirname, '..', 'public', u.replace(/^\//, '').replace(/\//g, path.sep));
        if (!fs.existsSync(local)) throw new Error(`Missing local ${local}`);
        fs.copyFileSync(local, destPath);
        return { source: 'local-state-icons', bytes: fs.statSync(destPath).size };
    }

    if (/^https?:\/\//i.test(u)) {
        try {
            const bytes = await downloadToFile(u, destPath);
            return { source: 'http', bytes };
        } catch (httpErr) {
            if (base) {
                try {
                    const bytes = await downloadFromFtpImages(base, destPath);
                    return { source: 'ftp-images', bytes };
                } catch (ftpErr) {
                    throw new Error(`${httpErr.message}; FTP: ${ftpErr.message}`);
                }
            }
            throw httpErr;
        }
    }

    throw new Error(`Unsupported URL: ${u}`);
}

async function main() {
    const sessionName = (process.argv[2] || 'Week 16C').trim();
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SECRET_KEY
        || process.env.SUPABASE_SERVICE_ROLE_KEY
        || process.env.SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) {
        console.error('Missing Supabase credentials in .env');
        process.exit(1);
    }

    const supabase = createClient(url, key);
    const { data: row, error } = await supabase.from(TABLE).select('value').eq('key', 'sessions').maybeSingle();
    if (error) throw error;

    const session = row?.value?.[sessionName];
    if (!session) {
        console.error(`Session not found: ${sessionName}`);
        console.error('Available:', Object.keys(row?.value || {}).sort().join(', '));
        process.exit(1);
    }

    const savedAt = session.savedAt ? new Date(session.savedAt) : new Date();
    const datePrefix = editionDatePrefix(savedAt);

    const outDir = path.join(OUT_ROOT, sessionName.replace(/[^\w.-]+/g, '-'));
    const articlesDir = path.join(outDir, 'articles-and-inspirational');
    const statesDir = path.join(outDir, 'states');
    fs.mkdirSync(articlesDir, { recursive: true });
    fs.mkdirSync(statesDir, { recursive: true });

    const manifest = {
        session: sessionName,
        savedAt: session.savedAt || null,
        editionDatePrefix: datePrefix,
        uploadTargets: {
            articlesFolder: 'Newsletter images/all',
            statesFolder: 'Newsletter images/all/states',
            inspirationalFolder: 'Newsletter images/inspirational',
            publicBase: 'https://purablis.com/Newsletter%20images',
        },
        articles: [],
        states: [],
        inspirational: [],
        errors: [],
    };

    const articles = (session.articles || []).filter(articleUsedInNewsletter);
    const seenArticles = new Set();

    for (const article of articles) {
        const stateMatch = matchStateIcons(article.imageSearchQuery || article.title || '', 1)[0]
            || matchStateIcons(article.title || '', 1)[0];

        if (stateMatch && stateMatch.title) {
            const stateFile = `${stateMatch.title}.png`;
            const srcLocal = path.join(STATE_ICONS_DIR, stateFile);
            const dest = path.join(statesDir, stateFile);
            try {
                if (!fs.existsSync(srcLocal)) throw new Error(`Missing ${srcLocal}`);
                fs.copyFileSync(srcLocal, dest);
                manifest.states.push({
                    state: stateMatch.title,
                    filename: stateFile,
                    title: article.title,
                    articleId: article.id,
                    suggestedUrl: `https://purablis.com/Newsletter%20images/all/states/${encodeURIComponent(stateFile)}`,
                });
            } catch (e) {
                manifest.errors.push({ type: 'state', title: article.title, error: e.message });
            }
        }

        const imageUrl = pickImageUrl(article);
        if (!imageUrl || seenArticles.has(article.id)) continue;
        seenArticles.add(article.id);

        if (stateMatch && /state_icons_dark|\/all\/states\//i.test(imageUrl)) {
            continue;
        }

        const exportName = buildArticleExportName(article, datePrefix);
        const dest = path.join(articlesDir, exportName);
        try {
            const { source, bytes } = await resolveImageBytes(imageUrl, dest);
            manifest.articles.push({
                filename: exportName,
                title: article.title,
                articleId: article.id,
                categories: getArticleCategories(article),
                sourceUrl: imageUrl,
                source,
                bytes,
                suggestedUrl: `https://purablis.com/Newsletter%20images/all/${encodeURIComponent(exportName)}`,
            });
        } catch (e) {
            manifest.errors.push({
                type: 'article',
                title: article.title,
                sourceUrl: imageUrl,
                error: e.message,
            });
        }
    }

    const inspList = Array.isArray(session.inspirationalImages)
        ? session.inspirationalImages
        : session.inspirationalImages
            ? [session.inspirationalImages]
            : [];

    for (let i = 0; i < inspList.length; i++) {
        const inspUrl = String(inspList[i] || '').trim();
        if (!inspUrl) continue;
        const base = inferBaseFilename(inspUrl) || `insp-${i + 1}.jpg`;
        const exportName = /^insp-/i.test(base) ? base : `insp-${base}`;
        const dest = path.join(articlesDir, exportName);
        try {
            const { source, bytes } = await resolveImageBytes(inspUrl, dest);
            manifest.inspirational.push({
                filename: exportName,
                sourceUrl: inspUrl,
                source,
                bytes,
                suggestedUrl: `https://purablis.com/Newsletter%20images/inspirational/${encodeURIComponent(exportName)}`,
            });
        } catch (e) {
            manifest.errors.push({ type: 'inspirational', sourceUrl: inspUrl, error: e.message });
        }
    }

    fs.writeFileSync(path.join(outDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);

    console.log(`Session: ${sessionName}`);
    console.log(`Output: ${outDir}`);
    console.log(`  articles-and-inspirational: ${manifest.articles.length} article + ${manifest.inspirational.length} inspirational`);
    console.log(`  states: ${manifest.states.length}`);
    console.log(`  errors: ${manifest.errors.length}`);
    if (manifest.errors.length) {
        console.log('\nErrors:');
        manifest.errors.forEach((e) => console.log(' -', e.type, e.title || e.sourceUrl, e.error));
    }
    console.log(`\nManifest: ${path.join(outDir, 'manifest.json')}`);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
