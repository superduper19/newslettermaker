require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs');
const path = require('path');
const { Client } = require('basic-ftp');
const {
    getFtpRemoteDir,
    buildPublicImageUrl,
    isPublicUrlReachable,
    getArticleSubfolder,
    getStatesSubfolder,
    getInspirationalSubfolder
} = require('../lib/purablis-public-url');

async function uploadTo(client, subfolder, targetName, localPath) {
    const filename = `test-${targetName}-${Date.now()}.png`;
    const remoteDir = getFtpRemoteDir(subfolder, process.env.GODADDY_FTP_PATH || 'images');
    const publicUrl = buildPublicImageUrl(filename, {
        subfolder,
        baseUrl: process.env.GODADDY_PUBLIC_BASE_URL,
    });

    console.log(`\n--- Testing ${targetName} ---`);
    console.log(`Subfolder: ${subfolder}`);
    console.log(`FTP Path:  ${remoteDir}/${filename}`);
    console.log(`Web URL:   ${publicUrl}`);
    
    // Ensure dir correctly handles deep nested paths like all/states by navigating up from root
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

    await client.uploadFrom(localPath, filename);
    console.log('Upload successful.');

    const reachable = await isPublicUrlReachable(publicUrl);
    if (reachable) {
        console.log(`Result: SUCCESS (Reachable)`);
    } else {
        console.log(`Result: UPLOADED BUT NOT REACHABLE (Check URL mapping)`);
    }
}

async function main() {
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
        await uploadTo(client, getArticleSubfolder(), 'Article', localPath);
        await uploadTo(client, getInspirationalSubfolder(), 'Inspirational', localPath);
        await uploadTo(client, getStatesSubfolder(), 'State_Icon', localPath);
    } catch(err) {
        console.error('Error during upload:', err);
    } finally {
        client.close();
    }
}

main();
