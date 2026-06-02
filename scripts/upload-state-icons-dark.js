/**
 * Upload US state icons from bookbunnylibrary/state_icons_dark to purablis.com via GoDaddy FTP.
 * Run: node scripts/upload-state-icons-dark.js
 * Optional: STATE_ICONS_SOURCE_DIR=C:\path\to\state_icons_dark
 *
 * Target on server: Newsletter images/all/states/ (e.g. Alabama.png)
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const {
    buildManifestFromFilenames,
    MANIFEST_PATH,
    reloadStateIconsManifest,
} = require('../lib/state-icons');
const {
    getFtpRemoteDir,
    getStatesSubfolder,
    getPublicBaseUrl,
} = require('../lib/purablis-public-url');

async function ftpCdToDir(client, remoteDir) {
    const parts = String(remoteDir || '').replace(/^\/+/, '').split('/').filter(Boolean);
    await client.cd('/');
    for (const part of parts) {
        try {
            await client.cd(part);
        } catch (e) {
            await client.send(`MKD ${part}`);
            await client.cd(part);
        }
    }
}

const DEFAULT_SOURCE = path.join(
    'C:',
    'Users',
    'kaveh',
    'Documents',
    'GitHub',
    'bookbunnylibrary',
    'state_icons_dark',
);

async function accessFtpClient() {
    const host = process.env.GODADDY_FTP_HOST;
    const user = process.env.GODADDY_FTP_USER;
    const password = process.env.GODADDY_FTP_PASS;
    const port = parseInt(process.env.GODADDY_FTP_PORT || '21', 10);
    if (!host || !user || !password) {
        throw new Error('GoDaddy FTP not configured (GODADDY_FTP_HOST, USER, PASS)');
    }
    const { Client } = require('basic-ftp');
    const client = new Client();
    client.ftp.verbose = false;
    await client.access({
        host,
        port,
        user,
        password,
        secure: true,
        secureOptions: { rejectUnauthorized: false },
    });
    return client;
}

function getStateIconsPublicBase() {
    const subfolder = getStatesSubfolder();
    const publicRoot = getPublicBaseUrl().replace(/\/+$/, '');
    return (
        process.env.GODADDY_STATE_PUBLIC_BASE_URL
        || `${publicRoot}/${subfolder.split('/').map(encodeURIComponent).join('/')}`
    ).replace(/\/+$/, '');
}

async function main() {
    const sourceDir = process.env.STATE_ICONS_SOURCE_DIR || DEFAULT_SOURCE;
    const remoteDir = getFtpRemoteDir(getStatesSubfolder(), process.env.GODADDY_FTP_PATH || 'images');
    const publicUrlBase = getStateIconsPublicBase();

    console.log('State icons upload → purablis.com\n');
    console.log('Source:', sourceDir);
    console.log('FTP dir:', remoteDir);
    console.log('Public base:', publicUrlBase);
    console.log('App preview: /state_icons_dark/\n');

    if (!fs.existsSync(sourceDir)) {
        console.error('Source directory not found:', sourceDir);
        process.exit(1);
    }

    const files = fs.readdirSync(sourceDir).filter((f) => /\.png$/i.test(f)).sort();
    if (!files.length) {
        console.error('No PNG files found in source directory.');
        process.exit(1);
    }

    const publicDir = path.join(__dirname, '..', 'public', 'state_icons_dark');
    if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });

    const client = await accessFtpClient();
    let ok = 0;
    let fail = 0;

    try {
        await ftpCdToDir(client, remoteDir);
        console.log('FTP cwd:', await client.pwd());
        console.log(`Uploading ${files.length} files...\n`);

        for (const filename of files) {
            const localPath = path.join(sourceDir, filename);
            try {
                fs.copyFileSync(localPath, path.join(publicDir, filename));
                await client.uploadFrom(localPath, filename);
                const purablisUrl = `${publicUrlBase}/${encodeURIComponent(filename)}`;
                ok += 1;
                console.log(`  OK  ${filename}`);
                console.log(`      ${purablisUrl}`);
            } catch (e) {
                fail += 1;
                console.error(`  FAIL ${filename}: ${e.message}`);
            }
        }
    } finally {
        client.close();
    }

    const manifest = buildManifestFromFilenames(files, '/state_icons_dark');
    const manifestDir = path.dirname(MANIFEST_PATH);
    if (!fs.existsSync(manifestDir)) {
        fs.mkdirSync(manifestDir, { recursive: true });
    }
    fs.writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
    reloadStateIconsManifest();

    console.log('\n---');
    console.log(`Uploaded: ${ok}, failed: ${fail}`);
    console.log('Manifest:', MANIFEST_PATH);
    console.log(`States in manifest: ${manifest.states.length}`);

    if (fail > 0) process.exit(1);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
