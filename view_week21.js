require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY
);

async function run() {
    const { data, error } = await supabase.from('newsletter_state').select('*').eq('key', 'sessions').single();
    if (error) {
        console.error('Error fetching sessions:', error);
        return;
    }
    
    const sessions = data.value;
    const week21 = sessions['Week 21'];
    
    if (!week21) {
        console.error('Week 21 session not found');
        return;
    }

    console.log(`Week 21 has ${week21.articles.length} articles.`);
    let idx = 0;
    for (const art of week21.articles) {
        console.log(`[${idx}] Title: ${art.title}`);
        console.log(`    URL: ${art.url}`);
        idx++;
    }
    
    fs.writeFileSync('week21_articles_backup.json', JSON.stringify(week21.articles, null, 2));
}

run();
