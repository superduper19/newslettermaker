const { Client } = require('basic-ftp');

async function listOldFtp() {
    const client = new Client();
    client.ftp.verbose = false;
    try {
        await client.access({
            host: 'p3plzcpnl460717.prod.phx3.secureserver.net',
            user: 'waka@purablis.com',
            password: '0Vnj9*wT&c!gxOC3n33}',
            secure: true,
            secureOptions: { rejectUnauthorized: false }
        });
        
        console.log(`Connected to old FTP. Listing root:`);
        const list = await client.list('/');
        list.forEach(i => console.log(i.isDirectory ? `DIR: ${i.name}` : `FILE: ${i.name}`));
        
    } catch(err) {
        console.error("FTP Error:", err);
    }
    client.close();
}
listOldFtp();
