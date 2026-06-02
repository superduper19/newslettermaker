require('dotenv').config();

async function tryGet(url) {
    const fetch = (await import('node-fetch')).default;
    try {
        const r = await fetch(url, { redirect: 'follow' });
        const buf = await r.arrayBuffer();
        return { status: r.status, len: buf.byteLength, ok: r.status === 200 && buf.byteLength > 500 };
    } catch (e) {
        return { status: 'err', len: 0, ok: false };
    }
}

async function main() {
    const { Client } = require('basic-ftp');
    const client = new Client();
    await client.access({
        host: process.env.GODADDY_FTP_HOST,
        port: parseInt(process.env.GODADDY_FTP_PORT || '21', 10),
        user: process.env.GODADDY_FTP_USER,
        password: process.env.GODADDY_FTP_PASS,
        secure: true,
        secureOptions: { rejectUnauthorized: false },
    });
    const pwd = await client.pwd();
    const entries = await client.list('images');
    const sample = entries.find((e) => e.isFile && e.name.startsWith('freepik-'))?.name
        || entries.find((e) => e.isFile && e.name.endsWith('.png'))?.name;
    client.close();

    console.log('FTP pwd:', pwd);
    console.log('Sample file on FTP:', sample);
    if (!sample) return;

    const bases = [
        'https://purablis.com/News-roundup/images',
        'https://purablis.com/images',
        'https://purablis.com/News-roundup',
        'https://www.purablis.com/images',
        'https://purablis.com',
    ];
    for (const base of bases) {
        const url = `${base.replace(/\/$/, '')}/${sample}`;
        const r = await tryGet(url);
        console.log(r.ok ? 'OK' : r.status, url);
    }
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
