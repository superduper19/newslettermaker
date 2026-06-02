const { Client } = require('basic-ftp');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function testUploadInspiration() {
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
        
        console.log(`Connected to FTP as ${process.env.GODADDY_FTP_USER}.`);
        
        // Use the real png from the repo
        const localPath = path.join(__dirname, 'stanford_test.png');
        const testFileName = `testinspiration.png`;
        
        console.log(`Uploading ${testFileName} to inspiration1/...`);
        // Navigate to the inspiration1 folder first
        await client.cd('inspiration1');
        await client.uploadFrom(localPath, testFileName);
        
        console.log("Upload complete. Here is the expected URL:");
        console.log(`https://purablis.com/purablis.com/newsletter/inspiration1/${testFileName}`);
        
    } catch(err) {
        console.error("FTP Error:", err);
    }
    client.close();
}
testUploadInspiration();
