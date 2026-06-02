const url = 'https://purablis.com/purablis.com/newsletter/06-01-26/06-01-26-freepik-10368712.png';
const match = url.match(/\/(\d{2}-\d{2}-\d{2})\//);
console.log(match ? match[1] : 'no match');
