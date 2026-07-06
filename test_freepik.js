require('dotenv').config();

const API_KEY = process.env.FREEPIK_API_KEY;
const QUERY = 'cannabis'; // Use a relevant query

async function testFreepik() {
    console.log('Testing Freepik/Magnific API...');

    if (typeof fetch === 'undefined') {
        global.fetch = (await import('node-fetch')).default;
    }

    const testHeaders = [
        { 'x-freepik-api-key': API_KEY },
        { 'X-Freepik-API-Key': API_KEY },
        { 'x-magnific-api-key': API_KEY },
        { 'X-Magnific-API-Key': API_KEY }
    ];

    const urls = [
        'https://api.freepik.com/v1/icons?locale=en-US&page=1&limit=3&term=' + QUERY,
        'https://api.magnific.com/v1/icons?locale=en-US&page=1&limit=3&term=' + QUERY
    ];

    for (const url of urls) {
        console.log(`\n--- Testing URL: ${url} ---`);
        for (const headers of testHeaders) {
            const headerName = Object.keys(headers)[0];
            console.log(`Trying header "${headerName}":`);
            try {
                const res = await fetch(url, { headers });
                console.log(`Response Status: ${res.status}`);
                const text = await res.text();
                if (res.ok) {
                    console.log(`✅ Success! Response preview: ${text.substring(0, 200)}`);
                    try {
                        const data = JSON.parse(text);
                        console.log(`Found ${data.data?.length || 0} items.`);
                    } catch(e) {}
                    return; // Exit on first success
                } else {
                    console.log(`❌ Error ${res.status}: ${text}`);
                }
            } catch (e) {
                console.error(`Network Error:`, e.message);
            }
        }
    }
}

testFreepik();
