const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY
);

async function fetchSessions() {
    const { data, error } = await supabase.from('newsletter_state').select('*').eq('key', 'sessions').single();
    if (error) {
        console.error('Error fetching sessions:', error);
        return;
    }
    
    const value = data.value;
    if (typeof value === 'object' && value !== null) {
        Object.keys(value).forEach(key => {
            const s = value[key];
            const name = s.name || s.id || key;
            const greeting = s.newsletterContent?.selectedGreeting || 'None';
            const dateStr = s.savedAt ? new Date(s.savedAt).toISOString().split('T')[0] : 'Unknown date';
            console.log(`Session: ${name} (${dateStr}) -> Greeting: ${greeting}`);
        });
    }
}

fetchSessions();
