const http = require('http');

const req = http.request({
    hostname: 'localhost',
    port: 5020,
    path: '/api/articles/summarize',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json'
    }
}, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => console.log('Response:', data));
});

req.on('error', (e) => {
    console.error('Request error:', e.message);
});

req.write(JSON.stringify({
    category: 'MED',
    articles: [{ title: 'Test', url: 'https://example.com' }],
    prompt: 'Summarize this',
    useRules: false
}));
req.end();
