const { Client } = require('basic-ftp');
require('dotenv').config();

async function testMasterAccount() {
    const client = new Client();
    client.ftp.verbose = false;
    try {
        await client.access({
            host: process.env.GODADDY_FTP_HOST,
            user: 'ktrpne91707e', // Master cPanel username
            password: process.env.GODADDY_FTP_PASS, // See if password is the same
            secure: true,
            secureOptions: { rejectUnauthorized: false }
        });
        
        console.log(`Connected as Master cPanel user!`);
        const list = await client.list('/');
        console.log("Root contents:");
        list.forEach(i => console.log(i.name));
        
    } catch(err) {
        console.error("Master FTP Error:", err.message);
    }
    client.close();
}
testMasterAccount();
