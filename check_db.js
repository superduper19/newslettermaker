const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY);

async function checkDb() {
    const { data } = await client
        .from(process.env.SUPABASE_STATE_TABLE || 'newsletter_state')
        .select('value')
        .eq('key', 'inspirational_library')
        .maybeSingle();

    if (data && data.value) {
        console.log(JSON.stringify(data.value.slice(0, 3), null, 2));
    } else {
        console.log("No data found");
    }
}
checkDb();
