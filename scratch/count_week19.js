require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const TABLE = process.env.SUPABASE_STATE_TABLE || 'newsletter_state';

async function main() {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) {
        console.error('Missing SUPABASE_URL or key');
        return;
    }
    const supabase = createClient(url, key);

    const { data: sessionsRow } = await supabase
        .from(TABLE)
        .select('value')
        .eq('key', 'sessions')
        .maybeSingle();

    if (!sessionsRow || !sessionsRow.value) {
        console.error('No sessions row found');
        return;
    }

    const sessions = sessionsRow.value;
    const week19 = sessions['Week 19'];
    if (!week19) {
        console.error('Week 19 session not found in DB');
        return;
    }

    const articles = week19.articles || [];
    console.log(`Analyzing Week 19: ${articles.length} articles`);

    const counts = { MED: 0, THC: 0, CBD: 0, INV: 0 };
    const items = { MED: [], THC: [], CBD: [], INV: [] };

    articles.forEach((a, idx) => {
        ['MED', 'THC', 'CBD', 'INV'].forEach(cat => {
            const ranks = a.ranks || {};
            const r = String(ranks[cat] || '').trim().toUpperCase();
            
            // Strictly Y, YM, or numerical ranks
            const isCounted = (r === 'Y' || r === 'YM' || /^\d+$/.test(r));
            if (isCounted) {
                counts[cat]++;
                items[cat].push({ index: idx, title: a.title, rank: r });
            } else if (r) {
                console.log(`Article #${idx} "${a.title}" has non-counted rank in ${cat}: "${r}"`);
            }
        });
    });

    console.log('\n--- STRICT CATEGORY COUNTS FOR WEEK 19 ---');
    console.log(`MED: ${counts.MED}`);
    console.log(`THC: ${counts.THC}`);
    console.log(`CBD: ${counts.CBD}`);
    console.log(`INV: ${counts.INV}`);

    ['MED', 'THC', 'CBD', 'INV'].forEach(cat => {
        console.log(`\nArticles counted in ${cat} (${items[cat].length}):`);
        items[cat].forEach(item => {
            console.log(`  - [Rank: ${item.rank}] ${item.title}`);
        });
    });
}

main().catch(console.error);
