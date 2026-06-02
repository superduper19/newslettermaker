const { Client } = require('basic-ftp');
require('dotenv').config();

async function createFolder() {
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
        console.log(`Creating folder 'inspiration1'...`);
        
        await client.ensureDir('inspiration1');
        
        console.log(`Folder 'inspiration1' successfully created!`);
        
    } catch(err) {
        console.error("FTP Error:", err);
    }
    client.close();
}
createFolder();
