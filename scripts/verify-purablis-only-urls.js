/**
 * Sanity check: newsletter HTML builders must not emit localhost /api proxy image URLs.
 * Run: node scripts/verify-purablis-only-urls.js
 */
const fs = require('fs');
const path = require('path');

const appJs = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'app.js'), 'utf8');

const forbidden = [
    'purablisUrlToAssetProxy',
    'getNewsletterImageProxyUrl',
    'statePurablisUrlToLocalPreview',
];

const failures = forbidden.filter((name) => appJs.includes(name));
if (failures.length) {
    console.error('FAIL: app.js still references local proxy helpers:', failures.join(', '));
    process.exit(1);
}

if (!appJs.includes('function resolvePurablisImageUrl')) {
    console.error('FAIL: resolvePurablisImageUrl missing');
    process.exit(1);
}

if (!/function getArticleImageUrlForSend[\s\S]*?return resolvePurablisImageUrl\(article\)/.test(appJs)) {
    console.error('FAIL: getArticleImageUrlForSend should delegate to resolvePurablisImageUrl');
    process.exit(1);
}

const e2eDir = path.join(__dirname, '..', 'test-output', 'e2e-newsletter');
if (fs.existsSync(e2eDir)) {
    const htmlFiles = fs.readdirSync(e2eDir).filter((f) => f.endsWith('.html'));
    const bad = [];
    htmlFiles.forEach((file) => {
        const html = fs.readFileSync(path.join(e2eDir, file), 'utf8');
        if (/localhost|127\.0\.0\.1|\/api\/images\/asset\//i.test(html)) {
            bad.push(file);
        }
    });
    if (bad.length) {
        console.warn('WARN: existing e2e HTML still has local URLs (regenerate after deploy):', bad.join(', '));
    }
}

console.log('OK: purablis-only image URL policy checks passed');
