require('dotenv').config();
async function testFreepik() {
    const fetch = (await import('node-fetch')).default;
    const API_KEY = process.env.FREEPIK_API_KEY;
    if (!API_KEY) {
        console.error('No FREEPIK_API_KEY found in .env');
        return;
    }
    console.log('Testing Freepik API...');
    try {
        const url = 'https://api.freepik.com/v1/resources?q=cannabis&limit=1';
        const response = await fetch(url, {
            headers: {
                'Accept-Language': 'en-US',
                'Accept': 'application/json',
                'x-freepik-api-key': API_KEY
            }
        });
        const status = response.status;
        console.log('Status:', status);
        const data = await response.json();
        if (status === 200) {
            console.log('Success!', data.data ? 'Found ' + data.data.length + ' results.' : data);
        } else {
            console.error('Error:', data);
        }
    } catch (e) {
        console.error('Exception:', e);
    }
}
testFreepik();
