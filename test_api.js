const http = require('http');

http.get('http://localhost:5020/api/images/inspirational-library', (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        try {
            const json = JSON.parse(data);
            console.log(JSON.stringify(json.images.slice(0, 3), null, 2));
        } catch (e) {
            console.error('Error parsing JSON:', e.message);
        }
    });
}).on('error', (err) => {
    console.log('Error: ' + err.message);
});
