const { Client } = require('basic-ftp');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function testUploadImage() {
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
        
        const localPath = path.join(__dirname, 'check_size_local.png'); // using the image we downloaded earlier as a test
        const testFileName = `test-img-${Date.now()}.png`;
        
        console.log(`Uploading ${testFileName}...`);
        await client.uploadFrom(localPath, testFileName);
        
        console.log("Upload complete. Here is the expected URL:");
        console.log(`https://purablis.com/newsletter/${testFileName}`);
        
    } catch(err) {
        console.error("FTP Error:", err);
    }
    client.close();
}
testUploadImage();
