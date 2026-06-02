const { Client } = require('basic-ftp');
require('dotenv').config();

async function searchIndex() {
    const client = new Client();
    client.ftp.verbose = false;
    try {
        await client.access({
            host: process.env.GODADDY_FTP_HOST,
            user: process.env.GODADDY_FTP_USER,
            password: process.env.GODADDY_FTP_PASS,
            secure: true,
            secureOptions: { rejectUnauthorized: false }
        });
        
        console.log("Connected. Searching for index.html or index.php...");
        
        async function walk(dir) {
            try {
                const list = await client.list(dir);
                for (const item of list) {
                    if (item.isDirectory && item.name !== '.' && item.name !== '..') {
                        // ignore obvious non-web roots to save time
                        if (!['.cpanel', '.trash', 'mail', 'etc', 'ssl', 'tmp', 'logs', 'TEST RUN INTEGRATION-07-01-2023', 'week-1-22-02-2026', '02-23-26'].includes(item.name)) {
                            await walk(dir === '/' ? `/${item.name}` : `${dir}/${item.name}`);
                        }
                    } else if (item.name === 'index.html' || item.name === 'index.php') {
                        console.log(`Found: ${dir === '/' ? '' : dir}/${item.name}`);
                    }
                }
            } catch(e) {}
        }
        
        await walk('/');
        
    } catch(err) {
        console.error(err);
    }
    client.close();
}
searchIndex();
