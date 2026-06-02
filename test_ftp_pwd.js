const { Client } = require('basic-ftp');
require('dotenv').config();

async function checkPwd() {
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
        
        console.log(`Connected as ${process.env.GODADDY_FTP_USER}.`);
        const pwd = await client.pwd();
        console.log(`Current Working Directory upon login: ${pwd}`);
        
    } catch(err) {
        console.error("FTP Error:", err);
    }
    client.close();
}
checkPwd();
