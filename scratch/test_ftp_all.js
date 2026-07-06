require('dotenv').config();
const { getFtpRemoteDir, getPublicBaseUrl } = require('../lib/purablis-public-url');
const { Client } = require('basic-ftp');

function getRemotePath(subfolder) {
    const publicRoot = getPublicBaseUrl().replace(/\/+$/, '');
    const publicBase = (
        process.env.GODADDY_STATE_PUBLIC_BASE_URL
        || `${publicRoot}/${subfolder.split('/').map(encodeURIComponent).join('/')}`
    ).replace(/\/+$/, '');
    return {
        remoteDir: getFtpRemoteDir(subfolder, process.env.GODADDY_FTP_PATH || 'images'),
        publicUrlBase: publicBase,
        publicSubfolder: subfolder,
    };
}

async function testFtp() {
    const ftp = {
        host: process.env.GODADDY_FTP_HOST,
        user: process.env.GODADDY_FTP_USER,
        password: process.env.GODADDY_FTP_PASS,
        port: parseInt(process.env.GODADDY_FTP_PORT || '21')
    };
    
    if (!ftp.host) return console.log('No FTP config in .env');

    const client = new Client();
    try {
        await client.access({
            host: ftp.host,
            port: ftp.port,
            user: ftp.user,
            password: ftp.password,
            secure: true,
            secureOptions: { rejectUnauthorized: false },
        });

        const baseDir = getFtpRemoteDir('');
        console.log(`Listing baseDir: ${baseDir}`);
        const entries = await client.list(baseDir);
        
        let totalFiles = 0;
        for (const e of entries) {
            if (e.isDirectory && /^\d{2}-\d{2}-\d{2}$/.test(e.name)) {
                const subPathInfo = getRemotePath(e.name);
                console.log(`  Found date dir: ${e.name}. Listing ${subPathInfo.remoteDir}...`);
                const subEntries = await client.list(subPathInfo.remoteDir);
                const files = subEntries.filter(se => se.isFile && se.name.endsWith('.png'));
                totalFiles += files.length;
                console.log(`    Found ${files.length} images (URL Base: ${subPathInfo.publicUrlBase})`);
            }
        }
        console.log(`Total images found: ${totalFiles}`);
    } catch (e) {
        console.error(e);
    } finally {
        client.close();
    }
}
testFtp();
