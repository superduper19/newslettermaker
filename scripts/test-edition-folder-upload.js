/**
 * Upload a tiny test PNG into Newsletter images/<MM-DD-YY>/ via FTP and verify public URL.
 * Run: node scripts/test-edition-folder-upload.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs');
const path = require('path');
const { Client } = require('basic-ftp');
const {
    getFtpRemoteDir,
    buildPublicImageUrl,
    isPublicUrlReachable,
} = require('../lib/purablis-public-url');

function editionFolderFromToday() {
    const d = new Date();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const yy = String(d.getFullYear()).slice(-2);
    return `${mm}-${dd}-${yy}`;
}

async function main() {
    const subfolder = editionFolderFromToday();
    const filename = `e2e-folder-test-${Date.now()}.png`;
    const localPath = path.join(__dirname, 'test-insp-tiny.png');
    if (!fs.existsSync(localPath)) {
        console.error('Missing test image:', localPath);
        process.exit(1);
    }

    const host = process.env.GODADDY_FTP_HOST;
    const user = process.env.GODADDY_FTP_USER;
    const pass = process.env.GODADDY_FTP_PASS;
    if (!host || !user || !pass) {
        console.error('FTP not configured in .env (GODADDY_FTP_HOST/USER/PASS)');
        process.exit(1);
    }

    const remoteDir = getFtpRemoteDir(subfolder, process.env.GODADDY_FTP_PATH || 'images');
    const publicUrl = buildPublicImageUrl(filename, {
        subfolder,
        baseUrl: process.env.GODADDY_PUBLIC_BASE_URL,
    });

    console.log('Edition folder:', subfolder);
    console.log('FTP remote dir:', remoteDir);
    console.log('GODADDY_FTP_WEB_ROOT:', process.env.GODADDY_FTP_WEB_ROOT || '(not set)');
    console.log('Public URL:', publicUrl);
    console.log('GODADDY_NEWSLETTER_IMAGES_FTP_PATH:', process.env.GODADDY_NEWSLETTER_IMAGES_FTP_PATH || '(not set)');
    console.log('GODADDY_PUBLIC_BASE_URL:', process.env.GODADDY_PUBLIC_BASE_URL || '(default purablis)');

    const client = new Client();
    client.ftp.verbose = false;
    await client.access({
        host,
        port: parseInt(process.env.GODADDY_FTP_PORT || '21', 10),
        user,
        password: pass,
        secure: true,
        secureOptions: { rejectUnauthorized: false },
    });
    try {
        await client.ensureDir(remoteDir);
        await client.uploadFrom(localPath, filename);
        console.log('FTP upload OK');
    } finally {
        client.close();
    }

    const reachable = await isPublicUrlReachable(publicUrl);
    if (reachable) {
        console.log('\nSUCCESS: Image is publicly reachable.');
        console.log('Open in browser:', publicUrl);
        process.exit(0);
    }

    console.error('\nFAIL: Uploaded but public URL not reachable (404 or blocked).');
    console.error('URL tested:', publicUrl);
    process.exit(1);
}

main().catch((err) => {
    console.error('Test failed:', err.message);
    process.exit(1);
});
