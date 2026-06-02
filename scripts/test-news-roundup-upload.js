/**
 * Upload test files to public_html/News-roundup/images and verify public URLs.
 * Run: node scripts/test-news-roundup-upload.js
 */
require('dotenv').config();
const path = require('path');
const { Client } = require('basic-ftp');
const {
    getFtpRemoteDir,
    getArticleSubfolder,
    getStatesSubfolder,
    getInspirationalSubfolder,
    getPublicBaseUrl,
    applyEditionDatePrefix,
    getDefaultFtpWebRoot,
    getDefaultFtpImagesDir,
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

async function head(url) {
    const fetch = (await import('node-fetch')).default;
    const r = await fetch(url, { method: 'HEAD', redirect: 'follow' });
    return r.status;
}

async function uploadOne(client, remoteDir, filename, localPath) {
    await ftpCdToDir(client, remoteDir);
    const pwd = await client.pwd();
    await client.uploadFrom(localPath, filename);
    return pwd;
}

async function main() {
    const host = process.env.GODADDY_FTP_HOST;
    const user = process.env.GODADDY_FTP_USER;
    const password = process.env.GODADDY_FTP_PASS;
    if (!host || !user || !password) {
        console.error('Set GODADDY_FTP_HOST, GODADDY_FTP_USER, GODADDY_FTP_PASS in .env');
        process.exit(1);
    }

    const localVirginia = path.join(__dirname, '..', 'public', 'state_icons_dark', 'Virginia.png');
    const localTiny = path.join(__dirname, 'test-insp-tiny.png');
    const base = getPublicBaseUrl().replace(/\/+$/, '');
    const ts = Date.now();

    console.log('FTP user:', user);
    console.log('FTP web root:', getDefaultFtpWebRoot());
    console.log('FTP images dir:', getDefaultFtpImagesDir());
    console.log('Public base:', base);
    console.log('');

    const jobs = [
        {
            label: 'article (flat test)',
            remoteDir: getFtpRemoteDir(''),
            file: applyEditionDatePrefix(`nr-article-${ts}.png`),
            local: localTiny,
            urlPath: applyEditionDatePrefix(`nr-article-${ts}.png`),
        },
        {
            label: 'article (all/)',
            remoteDir: getFtpRemoteDir(getArticleSubfolder()),
            file: applyEditionDatePrefix(`nr-all-${ts}.png`),
            local: localTiny,
            urlPath: `${getArticleSubfolder()}/${applyEditionDatePrefix(`nr-all-${ts}.png`)}`,
        },
        {
            label: 'state icon',
            remoteDir: getFtpRemoteDir(getStatesSubfolder()),
            file: 'Virginia.png',
            local: localVirginia,
            urlPath: `${getStatesSubfolder()}/Virginia.png`,
        },
        {
            label: 'inspirational',
            remoteDir: getFtpRemoteDir(getInspirationalSubfolder()),
            file: `insp-nr-test-${ts}.png`,
            local: localTiny,
            urlPath: `${getInspirationalSubfolder()}/insp-nr-test-${ts}.png`,
        },
    ];

    const client = new Client();
    await client.access({
        host,
        port: parseInt(process.env.GODADDY_FTP_PORT || '21', 10),
        user,
        password,
        secure: true,
        secureOptions: { rejectUnauthorized: false },
    });

    console.log('Login pwd:', await client.pwd());
    console.log('');

    const results = [];
    for (const job of jobs) {
        const url = `${base}/${job.urlPath.split('/').map(encodeURIComponent).join('/')}`;
        try {
            const pwd = await uploadOne(client, job.remoteDir, job.file, job.local);
            const status = await head(url);
            results.push({ ...job, pwd, url, status, ok: status === 200 });
            console.log(job.label);
            console.log('  FTP:', pwd, '/', job.file);
            console.log('  cPanel:', `/home/…/${pwd}/${job.file}`.replace(/\/+/g, '/'));
            console.log('  URL:', status, url);
            console.log('');
        } catch (e) {
            results.push({ ...job, url, status: 'ERR', ok: false, error: e.message });
            console.log(job.label, 'FAIL', e.message);
            console.log('');
        }
    }
    client.close();

    const control = 'https://purablis.com/News-roundup/images/stanford.png';
    const controlStatus = await head(control);
    console.log('Control (existing):', controlStatus, control);

    const ok = results.filter((r) => r.ok).length;
    console.log('\n---');
    console.log(`New uploads reachable: ${ok}/${results.length}`);
    if (ok === 0) {
        console.log('\nIf stanford.png is 200 but new uploads are 404, the FTP user cannot write to the live docroot.');
        console.log('Use the main cPanel FTP user (not a domain-only user) or fix the FTP account path in .env.');
        process.exit(1);
    }
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
