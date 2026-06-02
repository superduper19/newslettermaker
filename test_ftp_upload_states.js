const { Client } = require('basic-ftp');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function uploadStates() {
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
        console.log(`Creating/navigating to 'states' folder...`);
        
        await client.ensureDir('states');
        
        const localStatesDir = path.join(__dirname, 'export', 'Week-16C', 'states');
        if (fs.existsSync(localStatesDir)) {
            console.log(`Uploading all files from ${localStatesDir} to /states...`);
            await client.uploadFromDir(localStatesDir);
            console.log(`Successfully uploaded states directory!`);
        } else {
            console.error(`Local states dir not found at ${localStatesDir}`);
        }
        
    } catch(err) {
        console.error("FTP Error:", err);
    }
    client.close();
}
uploadStates();
