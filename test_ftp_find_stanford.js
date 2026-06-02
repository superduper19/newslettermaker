const { Client } = require('basic-ftp');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

async function findStanford() {
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
        
        console.log("Connected. Searching for 'stanford.png' to find the true web root mapping...");
        
        let found = [];
        async function walk(dir) {
            try {
                const list = await client.list(dir);
                for (const item of list) {
                    if (item.isDirectory && item.name !== '.' && item.name !== '..') {
                        if (!['.cpanel', '.trash', 'mail', 'etc', 'ssl', 'tmp', 'logs', 'TEST RUN INTEGRATION-07-01-2023', 'week-1-22-02-2026', '02-23-26'].includes(item.name)) {
                            await walk(dir === '/' ? `/${item.name}` : `${dir}/${item.name}`);
                        }
                    } else if (item.name === 'stanford.png') {
                        found.push(dir === '/' ? `/${item.name}` : `${dir}/${item.name}`);
                    }
                }
            } catch(e) {}
        }
        
        await walk('/');
        console.log("Found stanford.png at:", found);
        
        if (found.length > 0) {
            // Upload test image to the same folder
            const targetDir = path.dirname(found[0]);
            console.log(`\nUploading curaleaf image to ${targetDir} to see if it shows up at https://purablis.com/News-roundup/images/upload-1779746744755-curaleaf.png`);
            
            await client.cd(targetDir);
            const localPath = path.join(process.env.TEMP, 'newsletter-uploads', 'upload-1779746744755-curaleaf.png');
            if (fs.existsSync(localPath)) {
                await client.uploadFrom(localPath, 'upload-1779746744755-curaleaf.png');
                console.log("Upload complete.");
            } else {
                console.log("Local file not found.");
            }
        }
        
    } catch(err) {
        console.error(err);
    }
    client.close();
}
findStanford();
