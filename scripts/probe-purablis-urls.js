require('dotenv').config();

async function head(url) {
    const fetch = (await import('node-fetch')).default;
    try {
        const r = await fetch(url, { method: 'HEAD', redirect: 'follow' });
        return r.status;
    } catch (e) {
        return 'err';
    }
}

async function main() {
    const files = ['state-oregon.png', 'freepik-4866690.png', 'upload-1779745277829-curaleaf.png'];
    const bases = [
        'https://purablis.com/News-roundup/images',
        'https://purablis.com/news-roundup/images',
        'https://purablis.com/images',
        'https://www.purablis.com/News-roundup/images',
        'https://purablis.com/News-roundup',
        'https://purablis.com',
    ];
    for (const base of bases) {
        for (const f of files) {
            const url = `${base}/${f}`.replace(/([^:]\/)\/+/g, '$1');
            const status = await head(url);
            if (status === 200) console.log('OK', status, url);
        }
    }
}

main();
