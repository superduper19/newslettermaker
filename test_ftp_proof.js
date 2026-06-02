const { Client } = require('basic-ftp');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function proveUpload() {
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
        
        console.log("Connected to FTP.");
        
        // Create a test file locally
        const testFilePath = path.join(__dirname, 'proof-of-upload.txt');
        fs.writeFileSync(testFilePath, `This file was uploaded at ${new Date().toISOString()}`);
        
        console.log("Uploading proof-of-upload.txt to the FTP root...");
        await client.uploadFrom(testFilePath, 'proof-of-upload.txt');
        
        console.log("Upload complete. Listing root directory contents to prove it's there:");
        const list = await client.list('/');
        list.forEach(i => {
            if (i.name === 'proof-of-upload.txt') {
                console.log(`---> FILE FOUND: ${i.name} (Size: ${i.size} bytes)`);
            } else {
                console.log(i.isDirectory ? `DIR: ${i.name}` : `FILE: ${i.name}`);
            }
        });
        
        // Clean up local file
        fs.unlinkSync(testFilePath);
        
    } catch(err) {
        console.error("FTP Error:", err);
    }
    client.close();
}
proveUpload();
