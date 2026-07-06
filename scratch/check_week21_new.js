const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY
);

const ELIGIBLE_CATEGORY_STATUSES = ['Y', 'YM', 'COOL FINDS', 'LATER COOL'];

function normalizeArticleStatus(status) {
    const s = String(status ?? '').trim().toUpperCase();
    if (!s) return 'Y';
    if (s === 'N') return 'NO';
    if (s === 'M') return 'YM';
    return s;
}

function normalizeArticleDefaults(article) {
    if (!article || typeof article !== 'object') return;
    if (!article.status) article.status = 'Y';
    if (article.selected === undefined) article.selected = true;
    if (!article.ranks || typeof article.ranks !== 'object') article.ranks = {};
}

function isArticleEligibleForCategoryPicks(article) {
    normalizeArticleDefaults(article);
    if (article.selected === false) return false;
    return ELIGIBLE_CATEGORY_STATUSES.includes(normalizeArticleStatus(article.status));
}

function getRankForSort(article, category) {
    return article.ranks && article.ranks[category] ? article.ranks[category] : '';
}

function isCategoryRankIncluded(article, category) {
    if (!isArticleEligibleForCategoryPicks(article)) return false;
    const rank = String(getRankForSort(article, category)).trim().toUpperCase();
    if (!rank) return false;
    if (/^\d+$/.test(rank)) return true;
    return ['Y', 'YM', 'M'].includes(rank);
}

async function checkWeek21() {
    const { data, error } = await supabase.from('newsletter_state').select('*').eq('key', 'sessions').single();
    if (error) return console.error(error);
    
    const value = data.value;
    const week21 = value['Week 21'] || value['week 21'] || value['Week 21 '];
    if (!week21) return;
    
    const articles = week21.articles || week21.state?.articles || [];
    
    const stats = { MED: 0, THC: 0, CBD: 0, INV: 0, COOL: 0 };
    articles.forEach(a => {
        if (a.status === 'COOL FINDS') stats.COOL++;
        ['MED', 'THC', 'CBD', 'INV'].forEach(cat => {
            if (isCategoryRankIncluded(a, cat)) {
                stats[cat]++;
            }
        });
    });
    console.log('New Stats:', stats);
}

checkWeek21();
