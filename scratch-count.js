require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY);
const STATE_TABLE = process.env.SUPABASE_STATE_TABLE || 'newsletter_state';

async function countArticles() {
    const { data, error } = await supabase.from(STATE_TABLE).select('*');
    if (error) {
        console.error("Error fetching state:", error);
        return;
    }
    
    // Find the state for the current session, or the one they are working on
    for (const row of data) {
        let items = [];
        if (row.key === 'sessions') {
            items = Object.entries(row.value).map(([k, v]) => ({ name: k, articles: v.articles || [] }));
        } else if (row.key === 'workspace') {
            items = [{ name: 'workspace', articles: row.value.articles || [] }];
        } else {
            continue;
        }

        for (const session of items) {
            const articles = session.articles;
            const counts = { MED: 0, THC: 0, CBD: 0, INV: 0 };
            for (const a of articles) {
                // Count logic
                const status = (a.status || '').toUpperCase();
                const isEligible = ['Y', 'YM', 'M'].includes(status);
                if (!isEligible) continue;
                
                for (const cat of ['MED', 'THC', 'CBD', 'INV']) {
                    const ranks = a.ranks || {};
                    const rank = String(ranks[cat] || '').trim().toUpperCase();
                    if (rank && (/^\d+$/.test(rank) || rank === 'Y' || rank === 'YM')) {
                        counts[cat]++;
                    }
                }
            }
            console.log(`Session/Key: ${session.name}`);
            console.log(`Current Code Counts (with 'M' status allowed): MED:${counts.MED} THC:${counts.THC} CBD:${counts.CBD} INV:${counts.INV}`);
            
            const strictCounts = { MED: 0, THC: 0, CBD: 0, INV: 0 };
            for (const a of articles) {
                const status = (a.status || '').toUpperCase();
                const isEligible = ['Y', 'YM'].includes(status);
                if (!isEligible) continue;
                
                for (const cat of ['MED', 'THC', 'CBD', 'INV']) {
                    const ranks = a.ranks || {};
                    const rank = String(ranks[cat] || '').trim().toUpperCase();
                    if (rank && (/^\d+$/.test(rank) || rank === 'Y' || rank === 'YM')) {
                        strictCounts[cat]++;
                    }
                }
            }
            console.log(`Strict Counts (only 'Y', 'YM' status allowed): MED:${strictCounts.MED} THC:${strictCounts.THC} CBD:${strictCounts.CBD} INV:${strictCounts.INV}`);
            console.log('---');
        }
    }
}
countArticles();
