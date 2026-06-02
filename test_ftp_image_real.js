const { Client } = require('basic-ftp');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function testUploadImageReal() {
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
        
        // This is a REAL png from the repo (7.8kb), not an HTML error file!
        const localPath = path.join(__dirname, 'stanford_test.png');
        const testFileName = `real-test-img-${Date.now()}.png`;
        
        console.log(`Uploading ${testFileName}...`);
        await client.uploadFrom(localPath, testFileName);
        
        console.log("Upload complete. Here is the expected URL:");
        console.log(`https://purablis.com/purablis.com/newsletter/${testFileName}`);
        
    } catch(err) {
        console.error("FTP Error:", err);
    }
    client.close();
}
testUploadImageReal();
