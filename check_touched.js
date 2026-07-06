const fs = require('fs');
const data = JSON.parse(fs.readFileSync('week21_articles_backup.json'));

data.forEach((d, i) => {
    let touched = false;
    if (d.notes && d.notes !== '') touched = true;
    if (d.image && d.image !== null) touched = true;
    if (d.status !== 'Y' && d.status !== 'YM') touched = true; // Wait, maybe they changed status?
    
    console.log(`[${i}] Touched? ${touched} | Notes: "${d.notes}" | Img: ${!!d.image} | Title: ${d.title} | URL: ${d.url}`);
});
