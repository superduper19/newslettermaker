const { Client } = require('basic-ftp');
require('dotenv').config();

async function checkFtp() {
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
        
        console.log("Checking public_html/Newsletter images/all:");
        try {
            const list = await client.list('public_html/Newsletter images/all');
            list.filter(i => i.name.includes('curaleaf')).forEach(i => console.log(i.name));
        } catch(e) { console.error(e.message); }

        console.log("Checking public_html/images:");
        try {
            const list = await client.list('public_html/images');
            list.filter(i => i.name.includes('curaleaf')).forEach(i => console.log(i.name));
        } catch(e) { console.error(e.message); }
        
    } catch(err) {
        console.error(err);
    }
    client.close();
}
checkFtp();
