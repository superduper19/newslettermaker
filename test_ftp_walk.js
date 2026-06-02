const { Client } = require('basic-ftp');
require('dotenv').config();

async function walk(client, dir, results) {
    try {
        const list = await client.list(dir);
        for (const item of list) {
            const fullPath = dir === '/' ? `/${item.name}` : `${dir}/${item.name}`;
            if (item.isDirectory) {
                if (item.name !== '.' && item.name !== '..') {
                    await walk(client, fullPath, results);
                }
            } else if (item.name.includes('curaleaf')) {
                results.push(fullPath);
            }
        }
    } catch (e) {
        console.error(`Error listing ${dir}: ${e.message}`);
    }
}

async function searchFtp() {
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
        console.log("Connected. Searching...");
        let results = [];
        await walk(client, '/', results);
        console.log("Found:", results);
    } catch(err) {
        console.error(err);
    }
    client.close();
}
searchFtp();
