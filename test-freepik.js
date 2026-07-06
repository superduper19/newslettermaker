require('dotenv').config();

async function test() {
    const fetch = (await import('node-fetch')).default;
    const API_KEY = process.env.FREEPIK_API_KEY;
    if (!API_KEY) {
        console.error("No FREEPIK_API_KEY found in .env");
        return;
    }
    const url = 'https://api.magnific.com/v1/icons?locale=en-US&page=1&limit=9&term=trucking%20flat';
    try {
        const response = await fetch(url, {
            headers: {
                'X-Magnific-API-Key': API_KEY,
                'Accept-Language': 'en-US',
            }
        });
        
        console.log("Status:", response.status);
        const text = await response.text();
        console.log("Body:", text);
    } catch (e) {
        console.error("Error:", e);
    }
}
test();
