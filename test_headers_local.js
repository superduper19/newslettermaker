require('dotenv').config();
const API_KEY = process.env.FREEPIK_API_KEY;

// Dynamic import helper
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

async function run() {
    console.log('API Key:', API_KEY);
    const term = 'cannabis';

    const testCases = [
        {
            name: 'Freepik Host + X-Freepik-API-Key',
            url: `https://api.freepik.com/v1/icons?locale=en-US&page=1&limit=3&term=${term}`,
            headers: { 'X-Freepik-API-Key': API_KEY }
        },
        {
            name: 'Freepik Host + x-magnific-api-key',
            url: `https://api.freepik.com/v1/icons?locale=en-US&page=1&limit=3&term=${term}`,
            headers: { 'x-magnific-api-key': API_KEY }
        },
        {
            name: 'Magnific Host + x-magnific-api-key',
            url: `https://api.magnific.com/v1/icons?locale=en-US&page=1&limit=3&term=${term}`,
            headers: { 'x-magnific-api-key': API_KEY }
        },
        {
            name: 'Magnific Host + X-Freepik-API-Key',
            url: `https://api.magnific.com/v1/icons?locale=en-US&page=1&limit=3&term=${term}`,
            headers: { 'X-Freepik-API-Key': API_KEY }
        }
    ];

    for (const tc of testCases) {
        console.log(`\n--- Running test: ${tc.name} ---`);
        try {
            const res = await fetch(tc.url, { headers: tc.headers });
            console.log('Status:', res.status);
            const text = await res.text();
            console.log('Response:', text.substring(0, 300));
        } catch (e) {
            console.error('Error:', e.message);
        }
    }
}

run();
