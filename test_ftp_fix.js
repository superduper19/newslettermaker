const { Client } = require('basic-ftp');
const fs = require('fs');
const path = require('path');
require('dotenv').config();
const { getFtpRemoteDir, getArticleSubfolder } = require('./lib/purablis-public-url');

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
        
        console.log("Connected. Moving curaleaf image to correct web folder...");
        
        // Ensure the correct folder exists
        const remoteDir = getFtpRemoteDir(getArticleSubfolder()); // public_html/Newsletter images/all
        const parts = remoteDir.split('/');
        
        await client.cd('/');
        for (const part of parts) {
            try {
                await client.cd(part);
            } catch (e) {
                await client.send(`MKD ${part}`);
                await client.cd(part);
            }
        }
        
        // Upload the curaleaf image directly to the correct spot
        const localPath = path.join(process.env.TEMP, 'newsletter-uploads', 'upload-1779746744755-curaleaf.png');
        if (fs.existsSync(localPath)) {
            await client.uploadFrom(localPath, 'upload-1779746744755-curaleaf.png');
            console.log("Upload successful to " + remoteDir);
        } else {
            console.log("Local file not found at " + localPath);
        }
        
    } catch(err) {
        console.error(err);
    }
    client.close();
}
fixUpload();
