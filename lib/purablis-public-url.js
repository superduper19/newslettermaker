const path = require('path');

/** Article / state / inspirational (all/, all/states/, inspirational/) */
const NEWSLETTER_IMAGES_PUBLIC_ROOT = 'https://purablis.com/Newsletter%20images';
/** Legacy flat icons (stanford.png, etc.) */
const NEWS_ROUNDUP_PUBLIC_ROOT = 'https://purablis.com/News-roundup/images';

function getPublicBaseUrl() {
    const configured = String(process.env.GODADDY_PUBLIC_BASE_URL || '').trim().replace(/\/+$/, '');
    const decoded = configured.replace(/%20/gi, ' ');
    if (configured && /newsletter\s*images/i.test(decoded)) return configured;
    if (configured && /news-roundup/i.test(decoded)) {
        return configured;
    }
    if (configured) return configured;
    return NEWSLETTER_IMAGES_PUBLIC_ROOT;
}

function getNewsletterImagesFtpDir() {
    return String(
        process.env.GODADDY_NEWSLETTER_IMAGES_FTP_PATH || 'Newsletter images',
    ).replace(/^\/+/, '');
}

/** FTP path under account home → strip /home/USER/public_html for the public URL */
function getDefaultFtpWebRoot() {
    return String(process.env.GODADDY_FTP_WEB_ROOT || 'public_html').replace(/^\/+|\/+$/g, '');
}

/** Optional legacy flat folder (News-roundup/images); not used for all/ */
function getDefaultFtpImagesDir() {
    return String(process.env.GODADDY_FTP_PATH || 'News-roundup/images').replace(/^\/+/, '');
}
const DEFAULT_ARTICLE_SUBFOLDER = 'all';
const DEFAULT_STATES_SUBFOLDER = 'all/states';
const DEFAULT_INSPIRATIONAL_SUBFOLDER = 'inspirational';

function normalizePublicSubfolder(value) {
    return String(value || '')
        .trim()
        .replace(/\\/g, '/')
        .replace(/^\/+|\/+$/g, '');
}

function encodePublicPathSegment(segment) {
    return String(segment || '')
        .split('/')
        .filter(Boolean)
        .map((part) => encodeURIComponent(part))
        .join('/');
}

function extractImageFilename(url) {
    const value = String(url || '').trim();
    if (!value) return '';
    const match = value.match(/\/([^/?#]+\.(?:png|jpe?g|gif|webp|svg))(?:\?|#|$)/i);
    return match ? match[1] : '';
}

function buildPublicImageUrl(filename, options = {}) {
    const base = (options.baseUrl || getPublicBaseUrl()).replace(/\/+$/, '');
    let subfolder = normalizePublicSubfolder(
        options.subfolder !== undefined ? options.subfolder : process.env.GODADDY_PUBLIC_SUBFOLDER,
    );
    if (!subfolder) {
        const match = String(filename || '').match(/(?:^|\/)(\d{2}-\d{2}-\d{2})-/);
        if (match) subfolder = match[1];
    }
    const file = encodePublicPathSegment(path.basename(filename || ''));
    if (!file) return '';
    return subfolder ? `${base}/${encodePublicPathSegment(subfolder)}/${file}` : `${base}/${file}`;
}

function getPublicUrlCandidates(filename, subfolder, options = {}) {
    const file = path.basename(filename || '');
    if (!file) return [];
    let folder = normalizePublicSubfolder(
        subfolder !== undefined ? subfolder : process.env.GODADDY_PUBLIC_SUBFOLDER,
    );
    if (!folder) {
        const match = String(filename || '').match(/(?:^|\/)(\d{2}-\d{2}-\d{2})-/);
        if (match) folder = match[1];
    }
    const configuredBase = (options.baseUrl || getPublicBaseUrl()).replace(/\/+$/, '');
    const roots = [...new Set([NEWSLETTER_IMAGES_PUBLIC_ROOT, NEWS_ROUNDUP_PUBLIC_ROOT, configuredBase].filter(Boolean))];
    const bases = [];

    roots.forEach((root) => {
        if (folder) {
            bases.push(`${root}/${encodePublicPathSegment(folder)}/${encodePublicPathSegment(file)}`);
        }
        bases.push(`${root}/${encodePublicPathSegment(file)}`);
    });

    const legacy = (process.env.GODADDY_LEGACY_PUBLIC_BASE_URL || NEWSLETTER_IMAGES_PUBLIC_ROOT).replace(/\/+$/, '');
    if (folder) {
        bases.push(`${legacy}/${encodePublicPathSegment(folder)}/${encodePublicPathSegment(file)}`);
    }
    bases.push(`${legacy}/${encodePublicPathSegment(file)}`);

    return [...new Set(bases)];
}

async function isPublicUrlReachable(url) {
    if (!url || !/^https?:\/\//i.test(url)) return false;
    try {
        const fetch = (await import('node-fetch')).default;
        const r = await fetch(url, { method: 'HEAD', redirect: 'follow' });
        if (r.ok) return true;
        if (r.status === 405 || r.status === 403) {
            const r2 = await fetch(url, { method: 'GET', redirect: 'follow' });
            return r2.ok;
        }
        return false;
    } catch (e) {
        return false;
    }
}

async function findReachablePublicUrl(filename, subfolder, options = {}) {
    const candidates = getPublicUrlCandidates(filename, subfolder, options);
    for (const url of candidates) {
        if (await isPublicUrlReachable(url)) {
            return { url, publicReachable: true, tried: candidates };
        }
    }
    const fallback = buildPublicImageUrl(filename, { subfolder, baseUrl: options.baseUrl });
    return { url: fallback, publicReachable: false, tried: candidates };
}

function getFtpWebRootPrefix() {
    const root = getDefaultFtpWebRoot();
    if (!root || root === '.' || root === '/') return '';
    return `${root}/`;
}

function joinFtpPath(...parts) {
    return parts
        .map((p) => String(p || '').replace(/^\/+|\/+$/g, ''))
        .filter(Boolean)
        .join('/');
}

function editionDatePrefix(date = new Date()) {
    const d = date instanceof Date ? date : new Date(date);
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const yy = String(d.getFullYear()).slice(-2);
    return `${mm}-${dd}-${yy}`;
}

/** Weekly article images: 05-25-26-freepik-123.png in Newsletter images/all/ */
function applyEditionDatePrefix(filename, datePrefix) {
    const base = path.basename(String(filename || ''));
    if (!base) return '';
    if (/^\d{2}-\d{2}-\d{2}-/.test(base)) return base;
    return `${datePrefix || editionDatePrefix()}-${base}`;
}

function getArticleSubfolder() {
    return normalizePublicSubfolder(process.env.GODADDY_ARTICLE_FTP_SUBFOLDER || editionDatePrefix());
}

function getStatesSubfolder() {
    return normalizePublicSubfolder(process.env.GODADDY_STATE_FTP_PATH || 'states');
}

function getInspirationalSubfolder() {
    return normalizePublicSubfolder(
        process.env.GODADDY_INSPIRATIONAL_FTP_PATH || 'inspirational',
    );
}

function getFtpRemoteDir(subfolder, defaultDir = 'images') {
    const folder = normalizePublicSubfolder(subfolder);
    if (/^week-/i.test(folder)) return `${folder}/images`;

    const webRoot = getFtpWebRootPrefix().replace(/\/$/, '');
    const newsDir = getNewsletterImagesFtpDir();
    const base = joinFtpPath(webRoot, newsDir);
    
    if (!folder) return base || '/';
    return base ? `${base}/${folder}` : `/${folder}`;
}

module.exports = {
    DEFAULT_PUBLIC_ROOT: NEWSLETTER_IMAGES_PUBLIC_ROOT,
    NEWSLETTER_IMAGES_PUBLIC_ROOT,
    NEWS_ROUNDUP_PUBLIC_ROOT,
    getPublicBaseUrl,
    getNewsletterImagesFtpDir,
    getDefaultFtpWebRoot,
    getDefaultFtpImagesDir,
    DEFAULT_ARTICLE_SUBFOLDER,
    DEFAULT_STATES_SUBFOLDER,
    DEFAULT_INSPIRATIONAL_SUBFOLDER,
    normalizePublicSubfolder,
    extractImageFilename,
    buildPublicImageUrl,
    getPublicUrlCandidates,
    isPublicUrlReachable,
    findReachablePublicUrl,
    getFtpRemoteDir,
    editionDatePrefix,
    applyEditionDatePrefix,
    getArticleSubfolder,
    getStatesSubfolder,
    getInspirationalSubfolder,
};
