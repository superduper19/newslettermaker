const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY
);

async function searchInspirational() {
    const { data, error } = await supabase.from('newsletter_state').select('*').eq('key', 'sessions').single();
    if (error) {
        console.error('Error fetching sessions:', error);
        return;
    }
    
    const value = data.value;
    if (typeof value === 'object' && value !== null) {
        console.log("Searching for 'peale' or 'norman' in inspirational images...");
        Object.keys(value).forEach(key => {
            const s = value[key];
            const name = s.name || s.id || key;
            const dateStr = s.savedAt ? new Date(s.savedAt).toISOString().split('T')[0] : 'Unknown date';
            const state = s.state || {};
            
            // Check in newsletterContent.inspirationalImage
            const inspImage1 = state.newsletterContent?.inspirationalImage;
            
            // Or look in the articles
            const articles = state.articles || [];
            const hasNorman = articles.some(a => 
                (a.title && a.title.toLowerCase().includes('peale')) || 
                (a.title && a.title.toLowerCase().includes('norman')) ||
                (a.imageSearchQuery && a.imageSearchQuery.toLowerCase().includes('peale')) ||
                (a.originalImageUrl && a.originalImageUrl.toLowerCase().includes('peale')) ||
                (a.purablisFilename && a.purablisFilename.toLowerCase().includes('peale'))
            );
            
            if (inspImage1 && (inspImage1.toLowerCase().includes('peale') || inspImage1.toLowerCase().includes('norman'))) {
                console.log(`FOUND in session: ${name} (${dateStr}), Image URL: ${inspImage1}`);
            } else if (hasNorman) {
                console.log(`FOUND in session: ${name} (${dateStr}), related to an article/query.`);
                articles.forEach(a => {
                    if ((a.title && a.title.toLowerCase().includes('peale')) || 
                        (a.title && a.title.toLowerCase().includes('norman')) ||
                        (a.imageSearchQuery && a.imageSearchQuery.toLowerCase().includes('peale')) ||
                        (a.originalImageUrl && a.originalImageUrl.toLowerCase().includes('peale')) ||
                        (a.purablisFilename && a.purablisFilename.toLowerCase().includes('peale'))) {
                        console.log(`   - Article: ${a.title}`);
                        console.log(`   - Image URL: ${a.originalImageUrl}`);
                        console.log(`   - Purablis filename: ${a.purablisFilename}`);
                    }
                });
            }
        });
    }
}

searchInspirational();
