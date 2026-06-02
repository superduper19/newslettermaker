const { Client } = require('basic-ftp');

async function findStates() {
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
        
        console.log(`Connected to old FTP. Checking images/ folder...`);
        const listImages = await client.list('/images');
        listImages.forEach(i => console.log(i.isDirectory ? `DIR: /images/${i.name}` : `FILE: /images/${i.name}`));
        
        console.log(`Checking Newsletter images/ folder...`);
        const listNewsletter = await client.list('/Newsletter images');
        listNewsletter.forEach(i => console.log(i.isDirectory ? `DIR: /Newsletter images/${i.name}` : `FILE: /Newsletter images/${i.name}`));
        
    } catch(err) {
        console.error("FTP Error:", err);
    }
    client.close();
}
findStates();
