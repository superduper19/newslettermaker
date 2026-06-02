const path = require('path');
const { applyEditionDatePrefix, editionDatePrefix } = require('./purablis-public-url');

const CATEGORIES = ['MED', 'THC', 'CBD', 'INV'];
const NEWS_ROUNDUP_BASE = 'https://purablis.com/News-roundup/images';

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

function getArticleCategories(article) {
    const out = [];
    const ranks = article.ranks && typeof article.ranks === 'object' ? article.ranks : {};
    for (const cat of CATEGORIES) {
        const r = ranks[cat] ?? ranks[cat.toLowerCase()];
        if (r && /^(Y|YM|\d+|COOL FINDS)/i.test(String(r))) {
            out.push({ cat, rank: String(r) });
        }
    }
    if (!out.length && article.categories && Array.isArray(article.categories)) {
        article.categories.forEach((c) => {
            if (typeof c === 'object' && c.cat) {
                out.push({ cat: c.cat, rank: String(c.rank || 'Y') });
            }
        });
    }
    if (!out.length && article.status) {
        out.push({ cat: 'ART', rank: article.status });
    }
    return out;
}

function pickImageUrl(article) {
    for (const field of ['purablisFilename', 'publishedImageUrl', 'image', 'originalImageUrl', 'uploadedImageUrl']) {
        const v = article[field];
        if (v && String(v).trim() && !/^\/api\/images\/asset\//i.test(v)) {
            return String(v).trim();
        }
    }
    return '';
}

/** Same naming as scripts/export-session-images.js */
function buildArticleExportFilename(article, datePrefix) {
    if (article.purablisFilename) {
        const fn = path.basename(String(article.purablisFilename));
        return /^\d{2}-\d{2}-\d{2}-/.test(fn) ? fn : applyEditionDatePrefix(fn, datePrefix);
    }
    const base = inferBaseFilename(pickImageUrl(article)) || `${slugifyTitle(article.title)}.png`;
    const cats = getArticleCategories(article);
    const primary = cats[0] || { cat: 'ART', rank: '0' };
    const slug = slugifyTitle(article.title, 36);
    const ext = path.extname(base) || '.png';
    const core = path.basename(base, ext);
    const labeled = `${primary.cat}-${primary.rank}-${slug}-${core}${ext}`.replace(/--+/g, '-');
    return applyEditionDatePrefix(labeled, datePrefix);
}

function isShortPurablisImageUrl(url) {
    const u = String(url || '').trim();
    if (!/purablis\.com\/News-roundup\/images\//i.test(u)) return false;
    const fn = path.basename(u.split('?')[0]);
    if (/^\d{2}-\d{2}-\d{2}-/.test(fn)) return false;
    return /^(?:freepik|upload)-/i.test(fn);
}

function buildPurablisPublicUrl(filename, baseUrl = NEWS_ROUNDUP_BASE) {
    const base = String(baseUrl || NEWS_ROUNDUP_BASE).replace(/\/+$/, '');
    const file = encodeURIComponent(path.basename(filename || ''));
    return file ? `${base}/${file}` : '';
}

function getPurablisUrlCandidates(article, options = {}) {
    const base = (options.baseUrl || NEWS_ROUNDUP_BASE).replace(/\/+$/, '');
    const datePrefix = options.datePrefix || editionDatePrefix();
    const out = [];
    const add = (url) => {
        if (url && !out.includes(url)) out.push(url);
    };

    for (const field of ['publishedImageUrl', 'image', 'originalImageUrl', 'purablisFilename']) {
        const v = article[field];
        if (!v) continue;
        if (/^https?:\/\//i.test(v)) add(v.trim());
        else add(buildPurablisPublicUrl(v, base));
    }

    const exportName = buildArticleExportFilename(article, datePrefix);
    if (exportName) add(buildPurablisPublicUrl(exportName, base));

    const baseFile = inferBaseFilename(pickImageUrl(article));
    if (baseFile) {
        add(buildPurablisPublicUrl(applyEditionDatePrefix(baseFile, datePrefix), base));
        add(buildPurablisPublicUrl(baseFile, base));
    }

    return out.filter((u) => /purablis\.com/i.test(u));
}

module.exports = {
    NEWS_ROUNDUP_BASE,
    slugifyTitle,
    inferBaseFilename,
    buildArticleExportFilename,
    isShortPurablisImageUrl,
    buildPurablisPublicUrl,
    getPurablisUrlCandidates,
};
