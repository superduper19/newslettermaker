const { Client } = require('basic-ftp');
const fs = require('fs');

async function listFtp() {
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
        
        let path = process.env.GODADDY_FTP_PATH; // 'images'
        try {
            console.log(`Listing ${path}...`);
            const list1 = await client.list(path);
            const matches = list1.filter(i => !i.isDirectory && i.name.includes('curaleaf')).map(i => i.name);
            console.log("Matches:", matches);
        } catch(e) {
            console.error(e);
        }
        
    } catch(err) {
        console.error(err)
    }
    client.close();
}

require('dotenv').config();
listFtp();
