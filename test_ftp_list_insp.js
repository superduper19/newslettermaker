const { Client } = require('basic-ftp');
require('dotenv').config();

async function listFolder() {
    const client = new Client();
    client.ftp.verbose = false;
    try {
        await client.access({
            host: process.env.GODADDY_FTP_HOST,
            user: process.env.GODADDY_FTP_USER,
            password: process.env.GODADDY_FTP_PASS,
            secure: false
        });
        console.log("Connected to FTP. Listing inspiration1:");
        const list = await client.list('inspiration1');
        if (list.length === 0) console.log("Folder is empty.");
        for (const item of list) {
            console.log(item.type === 2 ? 'DIR: ' + item.name : 'FILE: ' + item.name);
        }
    } catch (err) {
        console.error(err);
    }
    client.close();
}
listFolder();
