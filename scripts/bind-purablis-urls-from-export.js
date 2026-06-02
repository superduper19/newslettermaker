/**
 * Point workspace + session articles at live News-roundup filenames from export manifest.
 * Run: node scripts/bind-purablis-urls-from-export.js "Week 16C"
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const TABLE = process.env.SUPABASE_STATE_TABLE || 'newsletter_state';
const PUBLIC_BASE = 'https://purablis.com/News-roundup/images';

function urlFor(filename) {
    return `${PUBLIC_BASE}/${encodeURIComponent(filename)}`;
}

function normTitle(t) {
    return String(t || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function bindArticles(articles, manifestArticles) {
    const byTitle = new Map(manifestArticles.map((m) => [normTitle(m.title), m]));
    const byId = new Map(manifestArticles.filter((m) => m.articleId != null).map((m) => [m.articleId, m]));
    let bound = 0;
    for (const article of articles) {
        const row = byId.get(article.id) || byTitle.get(normTitle(article.title));
        if (!row || !row.filename) continue;
        const url = urlFor(row.filename);
        article.purablisFilename = row.filename;
        article.publishedImageUrl = url;
        article.image = url;
        article.previewImageUrl = url;
        article.publicReachable = true;
        bound++;
    }
    return bound;
}

async function main() {
    const sessionName = (process.argv[2] || 'Week 16C').trim();
    const manifestPath = path.join(__dirname, '..', 'export', sessionName.replace(/[^\w.-]+/g, '-'), 'manifest.json');
    if (!fs.existsSync(manifestPath)) {
        console.error('Missing manifest:', manifestPath);
        process.exit(1);
    }
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    const manifestArticles = manifest.articles || [];

    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
        console.error('Missing Supabase credentials');
        process.exit(1);
    }
    const supabase = createClient(url, key);

    const { data: workspaceRow } = await supabase.from(TABLE).select('value').eq('key', 'workspace').maybeSingle();
    const { data: sessionsRow } = await supabase.from(TABLE).select('value').eq('key', 'sessions').maybeSingle();

    const workspace = workspaceRow?.value || { articles: [] };
    const sessions = sessionsRow?.value || {};

    const wsBound = bindArticles(workspace.articles || [], manifestArticles);
    workspace.newsletterContent = {
        ...(workspace.newsletterContent || {}),
        publicImageBase: PUBLIC_BASE,
        publicImageSubfolder: '',
        editionDatePrefix: manifest.editionDatePrefix || '',
        stateIconsPublicBase: `${PUBLIC_BASE}/states`,
        inspirationalPublicBase: PUBLIC_BASE,
    };
    workspace.publicImageBase = PUBLIC_BASE;
    workspace.publicImageSubfolder = '';

    let sessionBound = 0;
    if (sessions[sessionName]) {
        sessionBound = bindArticles(sessions[sessionName].articles || [], manifestArticles);
        sessions[sessionName].newsletterContent = {
            ...(sessions[sessionName].newsletterContent || {}),
            ...workspace.newsletterContent,
        };
    }

    await supabase.from(TABLE).upsert({ key: 'workspace', value: workspace }, { onConflict: 'key' });
    await supabase.from(TABLE).upsert({ key: 'sessions', value: sessions }, { onConflict: 'key' });

    console.log(`Bound ${wsBound} workspace + ${sessionBound} session articles from ${manifestPath}`);
    console.log(`Public base: ${PUBLIC_BASE}`);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
