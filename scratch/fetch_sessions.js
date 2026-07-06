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
    
    const sessions = data.value;
    if (!sessions || !sessions.length) {
        console.log('No sessions found.');
        return;
    }
    
    console.log('--- Sessions ---');
    sessions.forEach(session => {
        console.log(`Session Name: ${session.name}`);
        if (session.state && session.state.newsletterContent && session.state.newsletterContent.selectedGreeting) {
            console.log(`Selected Greeting: ${session.state.newsletterContent.selectedGreeting}`);
        } else {
            console.log(`Selected Greeting: (None/Default)`);
        }
        console.log('----------------');
    });
}

fetchSessions();
