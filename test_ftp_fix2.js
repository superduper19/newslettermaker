const { Client } = require('basic-ftp');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function fixUpload() {
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
        
        console.log("Connected. Moving curaleaf image to purablis.com/Newsletter images...");
        
        await client.cd('/');
        try { await client.cd('purablis.com'); } catch(e) { await client.send('MKD purablis.com'); await client.cd('purablis.com'); }
        try { await client.cd('Newsletter images'); } catch(e) { await client.send('MKD Newsletter images'); await client.cd('Newsletter images'); }
        
        const localPath = path.join(process.env.TEMP, 'newsletter-uploads', 'upload-1779746744755-curaleaf.png');
        if (fs.existsSync(localPath)) {
            await client.uploadFrom(localPath, 'upload-1779746744755-curaleaf.png');
            console.log("Upload successful to purablis.com/Newsletter images");
        } else {
            console.log("Local file not found at " + localPath);
        }
        
    } catch(err) {
        console.error(err);
    }
    client.close();
}
fixUpload();
