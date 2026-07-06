const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY
);

async function checkWeek21() {
    const { data, error } = await supabase.from('newsletter_state').select('*').eq('key', 'sessions').single();
    if (error) return console.error(error);
    
    const value = data.value;
    const week21 = value['Week 21'] || value['week 21'] || value['Week 21 '];
    if (!week21) return;
    
    const articles = week21.articles || week21.state?.articles || [];
    
    console.log('Articles with category pick but excluded by status:');
    articles.forEach(a => {
        const hasRank = ['MED', 'THC', 'CBD', 'INV'].some(cat => {
            const rank = String(a.ranks && a.ranks[cat] ? a.ranks[cat] : '').trim();
            return rank;
        });
        
        if (hasRank && !['Y', 'YM'].includes(a.status)) {
            console.log(`- Title: ${a.title}`);
            console.log(`  Status: "${a.status}"`);
            console.log(`  Ranks:`, a.ranks);
        }
    });
}

checkWeek21();
