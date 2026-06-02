const { Client } = require('basic-ftp');
require('dotenv').config();

async function listRoot() {
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
        
        console.log(`Connected to FTP as ${process.env.GODADDY_FTP_USER}. Listing root:`);
        const list = await client.list('/');
        list.forEach(i => console.log(i.isDirectory ? `DIR: ${i.name}` : `FILE: ${i.name}`));
        
    } catch(err) {
        console.error("FTP Error:", err);
    }
    client.close();
}
listRoot();
