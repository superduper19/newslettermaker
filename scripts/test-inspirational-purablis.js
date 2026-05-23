/**
 * Test inspirational image upload to purablis.com via FTP.
 * Run: node scripts/test-inspirational-purablis.js
 * Requires: server on PORT (default 5020) and GoDaddy FTP in .env
 */
require('dotenv').config();
const http = require('http');
const fs = require('fs');
const path = require('path');

const port = process.env.PORT || 5020;

function request(method, urlPath, body, headers = {}) {
    return new Promise((resolve, reject) => {
        const payload = body ? (typeof body === 'string' ? body : JSON.stringify(body)) : null;
        const opts = {
            hostname: 'localhost',
            port,
            path: urlPath,
            method,
            headers: {
                ...(payload
                    ? {
                        'Content-Type': headers['Content-Type'] || 'application/json',
                        'Content-Length': Buffer.byteLength(payload),
                    }
                    : {}),
                ...headers,
            },
        };
        const req = http.request(opts, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                let json = null;
                try {
                    json = JSON.parse(data);
                } catch (e) {
                    json = { raw: data };
                }
                resolve({ status: res.statusCode, json });
            });
        });
        req.on('error', reject);
        if (payload) req.write(payload);
        req.end();
    });
}

async function uploadMultipart(filePath) {
    const filename = path.basename(filePath);
    const fileBuf = fs.readFileSync(filePath);
    const form = new FormData();
    form.append('image', new Blob([fileBuf], { type: 'image/png' }), filename);
    const res = await fetch(`http://localhost:${port}/api/images/upload-inspirational`, {
        method: 'POST',
        body: form,
    });
    let json = null;
    const text = await res.text();
    try {
        json = JSON.parse(text);
    } catch (e) {
        json = { raw: text };
    }
    return { status: res.status, json };
}

async function main() {
    console.log('Inspirational → Purablis tests\n');
    console.log('FTP host:', process.env.GODADDY_FTP_HOST || '(missing)');
    console.log('Inspirational public base:', process.env.GODADDY_INSPIRATIONAL_PUBLIC_BASE_URL || '(derived)');
    console.log('');

    // 1) Publish external image URL to inspirational folder on purablis
    const sourceUrl = 'https://httpbin.org/image/png';
    console.log('1) POST /api/images/publish-to-purablis (target=inspirational)');
    console.log('   Source:', sourceUrl);
    const pub = await request('POST', '/api/images/publish-to-purablis', {
        url: sourceUrl,
        target: 'inspirational',
    });
    console.log('   Status:', pub.status);
    console.log('   Response:', JSON.stringify(pub.json, null, 2));

    if (pub.status !== 200 || !pub.json.success || !pub.json.url) {
        console.error('\n✗ Publish test failed');
        process.exit(1);
    }
    if (!String(pub.json.url).includes('purablis.com') || !String(pub.json.url).includes('/images/')) {
        console.error('\n✗ URL is not on purablis.com images path:', pub.json.url);
        process.exit(1);
    }
    console.log('   ✓ Published URL:', pub.json.url);
    const pubHead = await fetch(pub.json.url, { method: 'HEAD' });
    console.log('   HEAD check:', pubHead.status);

    // 2) Multipart upload tiny PNG
    const tinyPng = path.join(__dirname, 'test-insp-tiny.png');
    if (!fs.existsSync(tinyPng)) {
        // 1x1 red PNG
        const b64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
        fs.writeFileSync(tinyPng, Buffer.from(b64, 'base64'));
    }
    console.log('\n2) POST /api/images/upload-inspirational (multipart)');
    const up = await uploadMultipart(tinyPng);
    if (up.json.url) {
        const head = await fetch(up.json.url, { method: 'HEAD' });
        console.log('   HEAD check:', up.json.url, '→', head.status);
        if (!head.ok) {
            console.warn('   ⚠ URL returned', head.status, '(folder may need to exist in cPanel)');
        }
    }
    console.log('   Status:', up.status);
    console.log('   Response:', JSON.stringify(up.json, null, 2));

    if (up.status !== 200 || !up.json.success || !up.json.url) {
        console.error('\n✗ Upload test failed');
        process.exit(1);
    }
    if (!String(up.json.url).includes('purablis.com')) {
        console.error('\n✗ Upload URL not on purablis.com');
        process.exit(1);
    }
    console.log('   ✓ Upload URL:', up.json.url);

    // 3) Library list includes purablis entries
    console.log('\n3) GET /api/images/inspirational-library');
    const lib = await request('GET', '/api/images/inspirational-library');
    console.log('   Status:', lib.status);
    const count = Array.isArray(lib.json.images) ? lib.json.images.length : 0;
    const purablisCount = (lib.json.images || []).filter((i) => i.url && i.url.includes('purablis.com')).length;
    console.log('   Images in library:', count, '| on purablis.com:', purablisCount);
    if (!lib.json.success) {
        console.error('\n✗ Library list failed');
        process.exit(1);
    }
    console.log('   ✓ Library OK');

    console.log('\n✓ All inspirational Purablis tests passed.');
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
