require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY
);

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY.replace(/['"]+/g, '').trim());

async function run() {
    console.log("Fetching state from Supabase...");
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

    let updatedCount = 0;
    
    const model = genAI.getGenerativeModel({
        model: 'gemini-3.1-pro-preview',
        tools: [{ googleSearch: {} }],
    });

    for (let i = 0; i < week21.articles.length; i++) {
        const d = week21.articles[i];
        
        let touched = false;
        if (d.notes && d.notes !== '') touched = true;
        if (d.image && d.image !== null) touched = true;
        if (d.status !== 'Y' && d.status !== 'YM') touched = true;
        
        if (touched) {
            console.log(`Skipping [${i}] (touched): ${d.title}`);
            continue;
        }

        console.log(`Checking [${i}]: ${d.title}`);
        
        try {
            // First let's check if the URL is valid. For 403, we can't be sure if it's hallucinated or just anti-bot.
            // But if it's hallucinated, it usually has a weird path.
            // Actually, let's just ask Gemini to find the REAL link for the article title.
            const prompt = `Find the exact direct original deep-link URL for the following news article:
Title: "${d.title}"
Current suspected URL: ${d.url}

Reply with ONLY the exact URL (e.g., https://...). If you cannot find it, just reply "NOT_FOUND". DO NOT include any markdown formatting, backticks, or any other text.`;
            
            const result = await model.generateContent(prompt);
            let realUrl = result.response.text().trim();
            
            // Remove backticks if the model still outputs them
            realUrl = realUrl.replace(/^`+|`+$/g, '').trim();

            if (realUrl && realUrl !== 'NOT_FOUND' && realUrl.startsWith('http') && realUrl !== d.url) {
                console.log(`  -> URL fixed: ${realUrl}`);
                d.url = realUrl;
                updatedCount++;
            } else {
                console.log(`  -> URL kept: ${d.url}`);
            }
        } catch (e) {
            console.error(`  -> Error checking [${i}]:`, e.message);
        }
        
        // Sleep to avoid rate limits
        await new Promise(r => setTimeout(r, 2000));
    }

    if (updatedCount > 0) {
        console.log(`Updating Supabase with ${updatedCount} fixed URLs...`);
        const { error: updateError } = await supabase.from('newsletter_state').update({ value: sessions }).eq('key', 'sessions');
        if (updateError) {
            console.error('Failed to update Supabase:', updateError);
        } else {
            console.log('Successfully updated Week 21 in Supabase.');
        }
    } else {
        console.log('No URLs needed fixing.');
    }
}

run();
