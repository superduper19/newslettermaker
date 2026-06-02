require('dotenv').config();
const { Client } = require('basic-ftp');

async function listDir(client, dir) {
    try {
        console.log('\n---', dir || '(cwd)', '---');
        const entries = await client.list(dir || '.');
        entries.slice(0, 30).forEach((e) => {
            console.log((e.isDirectory ? '[DIR] ' : '      ') + e.name);
        });
        if (entries.length > 30) console.log(`... +${entries.length - 30} more`);
        return entries;
    } catch (e) {
        console.log('  (list failed:', e.message + ')');
        return [];
    }
}

async function main() {
    const client = new Client();
    await client.access({
        host: process.env.GODADDY_FTP_HOST,
        port: parseInt(process.env.GODADDY_FTP_PORT || '21', 10),
        user: process.env.GODADDY_FTP_USER,
        password: process.env.GODADDY_FTP_PASS,
        secure: true,
        secureOptions: { rejectUnauthorized: false },
    });
    await listDir(client, '.');
    await listDir(client, 'images');
    await listDir(client, 'images/state_icons_dark');
    await listDir(client, 'News-roundup/images');
    await listDir(client, 'News-roundup/images/state_icons_dark');
    client.close();
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
