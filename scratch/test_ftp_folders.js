require('dotenv').config();
const { getFtpRemoteDir, getArticleSubfolder, getNewsletterImagesFtpDir } = require('../lib/purablis-public-url');
const { Client } = require('basic-ftp');

async function testFtp() {
    console.log('Article subfolder:', getArticleSubfolder());
    console.log('Images Ftp Dir:', getNewsletterImagesFtpDir());
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

        const baseDir = '/';
        console.log(`Listing ${baseDir}:`);
        const entries = await client.list(baseDir);
        for (const e of entries) {
            console.log(e.type === 2 ? 'DIR' : 'FILE', e.name);
        }
    } catch (e) {
        console.error(e);
    } finally {
        client.close();
    }
}
testFtp();
