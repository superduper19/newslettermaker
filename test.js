const fs = require('fs');

function findHeaderTableBounds(html, marker) {
    const markerIndex = html.indexOf(marker);
    if (markerIndex === -1) return null;
    const tableStart = html.lastIndexOf('<table', markerIndex);
    const tableEnd = html.indexOf('</table>', markerIndex);
    if (tableStart === -1 || tableEnd === -1) return null;
    return { start: tableStart, end: tableEnd + 8 };
}

function replaceArticleSection(html, startMarker, endMarker, articles) {
    const startBounds = findHeaderTableBounds(html, startMarker);
    const endBounds = findHeaderTableBounds(html, endMarker);
    console.log(startMarker, startBounds);
    console.log(endMarker, endBounds);
    if (!startBounds || !endBounds || endBounds.start <= startBounds.end) {
        console.log("Failed bounds check");
        return html;
    }

    const currentSection = html.slice(startBounds.end, endBounds.start);
    const sampleMatch = currentSection.match(/<table[^>]*class="mcnCaptionRightImageContentContainer"[\s\S]*?<\/table>/i);
    if (!sampleMatch) {
        console.log("Failed sample match for", startMarker);
        return html;
    }

    const renderedTables = articles.map(a => `<table rendered><tr><td>${a.title}</td></tr></table>`).join('\n');
    return html.slice(0, startBounds.end) + '\n\n' + renderedTables + '\n\n' + html.slice(endBounds.start);
}

let html = fs.readFileSync('templates/med.html', 'utf8');

const mainArticles = [{title: 'Main 1'}, {title: 'Main 2'}];
const findsArticles = [{title: 'Find 1'}, {title: 'Find 2'}];

html = replaceArticleSection(html, 'Weekly News', 'Interesting Finds', mainArticles);
html = replaceArticleSection(html, 'Interesting Finds', 'Inspiration', findsArticles);

fs.writeFileSync('test_out.html', html);
console.log('Done');
