const { Client } = require('basic-ftp');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function testNewAccount() {
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
        
        // Create a test file locally
        const testFileName = `test-newsletter-upload-${Date.now()}.txt`;
        const testFilePath = path.join(__dirname, testFileName);
        fs.writeFileSync(testFilePath, `This file was uploaded to the new newsletter account at ${new Date().toISOString()}`);
        
        console.log(`Uploading ${testFileName} to the FTP root (/)...`);
        await client.uploadFrom(testFilePath, testFileName);
        
        console.log("Upload complete. Here is the expected URL:");
        console.log(`https://purablis.com/newsletter/${testFileName}`);
        
        // Clean up local file
        fs.unlinkSync(testFilePath);
        
    } catch(err) {
        console.error("FTP Error:", err);
    }
    client.close();
}
testNewAccount();
