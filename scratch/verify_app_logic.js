// Mocking the modified functions to verify correctness
function getRankForSort(article, cat) {
    const key = String(cat).trim().toUpperCase();
    let r = String(
        (article.ranks && (article.ranks[key] ?? article.ranks[cat])) ?? ''
    ).trim();
    return r;
}

function getSelectedRankCounts(articles) {
    let counts = { MED: 0, THC: 0, CBD: 0, INV: 0 };
    articles.forEach(a => {
        ['MED', 'THC', 'CBD', 'INV'].forEach(cat => {
            let r = String((a.ranks && a.ranks[cat]) || '').trim().toUpperCase();
            if (r === 'Y' || r === 'YM' || /^\d+$/.test(r)) {
                counts[cat]++;
            }
        });
    });
    return counts;
}

// Test cases
const mockArticles = [
    { title: "Art 1", categories: ["MED"], ranks: { MED: "" } }, // Empty rank
    { title: "Art 2", categories: ["MED"], ranks: { MED: "Y" } }, // Y
    { title: "Art 3", categories: ["THC"], ranks: { THC: "YM" } }, // YM
    { title: "Art 4", categories: ["CBD"], ranks: { CBD: "2" } }, // Number
    { title: "Art 5", categories: ["INV"], ranks: { INV: "M" } }, // M status
];

const counts = getSelectedRankCounts(mockArticles);
console.log('Resulting Counts:');
console.log(counts);

console.log('\nVerifying Rank for Sort on Art 1 (MED):');
console.log(`Expected: "", Got: "${getRankForSort(mockArticles[0], 'MED')}"`);

console.log('\nVerifying Rank for Sort on Art 2 (MED):');
console.log(`Expected: "Y", Got: "${getRankForSort(mockArticles[1], 'MED')}"`);

if (counts.MED === 1 && counts.THC === 1 && counts.CBD === 1 && counts.INV === 0) {
    console.log('\nSUCCESS: Verification passed! Empty is not counted, M is not counted, Y/YM/Numbers are counted.');
} else {
    console.log('\nFAILURE: Counts do not match expectations.');
}
