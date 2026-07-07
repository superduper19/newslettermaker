const express = require('express');
const router = express.Router();
const multer = require('multer');
const xlsx = require('xlsx');
const Anthropic = require('@anthropic-ai/sdk');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');

// Configure Multer for memory storage
const upload = multer({ storage: multer.memoryStorage() });

// Initialize Anthropic Client
const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
});

// Initialize OpenRouter (OpenAI SDK)
const openrouter = new OpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: process.env.OPENROUTER_API_KEY,
    defaultHeaders: {
        'HTTP-Referer': process.env.GODADDY_PUBLIC_BASE_URL || 'https://purablis.com',
        'X-Title': 'Newsletter Maker',
    }
});

// Initialize Google Generative AI Client
// Helper to clean API keys (removes quotes and whitespace)
const cleanKey = (key) => (key || '').replace(/^["']|["']$/g, '').trim();

const genAI = new GoogleGenerativeAI(cleanKey(process.env.GEMINI_API_KEY) || cleanKey(process.env.GOOGLE_API_KEY));

// Normalize Excel row: accept many column name variants
const getCell = (row, ...keys) => {
    for (const k of keys) {
        const v = row[k];
        if (v !== undefined && v !== null && String(v).trim() !== '') return String(v).trim();
    }
    return '';
};

// Helper to clean article data from Excel (flexible column names)
const cleanArticleData = (row, index) => {
    const title = getCell(row, 'Title', 'title', 'Article', 'article') || 'Untitled';
    const url = getCell(row, 'URL', 'url', 'Link', 'link');
    const description = getCell(row, 'Description', 'description', 'Summary', 'summary');
    const date = getCell(row, 'Date', 'date');
    const notes = getCell(row, 'Notes', 'notes');
    const paywallVal = row.Paywall ?? row.paywall ?? '';
    const paywall = paywallVal === true || String(paywallVal).toLowerCase() === 'yes' || String(paywallVal).toLowerCase() === 'y';
    const status = getCell(row, 'Status', 'status') || 'Y';
    const imageUrl = getCell(row, 'Image URL', 'Image URL', 'image', 'Image');

    const ranks = {};
    ['MED', 'THC', 'CBD', 'INV'].forEach(cat => {
        const v = row[cat];
        if (v !== undefined && v !== null && String(v).trim() !== '') ranks[cat] = String(v).trim();
    });
    const categories = Object.keys(ranks).length ? Object.keys(ranks) : (row.Category || row.category ? [row.Category || row.category] : []);

    return {
        id: index + 1,
        title,
        url,
        description,
        date,
        categories,
        ranks,
        notes,
        paywall,
        status,
        image: imageUrl || null,
        imageSearchQuery: '',
        isValid: true,
        selected: true,
    };
};

// Helper to verify URL and fetch content
const verifyAndAnalyzeUrl = async (url) => {
    if (!url) return { isValid: false, content: '' };
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout (Vercel-friendly)

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
            },
            signal: controller.signal,
        });
        clearTimeout(timeout);

        // 404/410 are definitely dead.
        if (response.status === 404 || response.status === 410) {
            console.log(`URL ${url} returned ${response.status}. Invalid.`);
            return { isValid: false, content: '', finalUrl: response.url };
        }

        // 403/401/429/5xx might be valid URLs blocking bots.
        // We'll mark them valid but content-less so we don't discard real news.
        if (!response.ok) {
            console.log(`URL ${url} returned ${response.status}. Treating as valid but unreadable.`);
            return { isValid: true, isReadable: false, content: '', finalUrl: response.url };
        }

        const text = await response.text();
        // Simple extraction of body text (stripping tags)
        const content = text.replace(/<script[^>]*>([\S\s]*?)<\/script>/gmi, '')
                            .replace(/<style[^>]*>([\S\s]*?)<\/style>/gmi, '')
                            .replace(/<[^>]+>/g, ' ')
                            .replace(/\s+/g, ' ')
                            .trim()
                            .substring(0, 15000); // Limit to 15k chars for LLM

        return { isValid: true, isReadable: true, content, finalUrl: response.url };
    } catch (error) {
        console.error(`Verification failed for ${url}:`, error.message);
        // If it's a timeout, maybe we should be lenient? For now, treat as invalid if we can't reach it.
        return { isValid: false, isReadable: false, content: '', finalUrl: url };
    }
};

// Helper to categorize article based on content (implements newsletter_categorization_brief.md)
const categorizeArticle = (article, content) => {
    if (!content) return article;

    const text = content.toLowerCase();
    const title = article.title.toLowerCase();
    const fullText = title + ' ' + text;

    // Initialize categories and ranks
    const categories = new Set(article.categories || []);
    const ranks = article.ranks || {};

    // --- REJECTION RULES (DISABLED FOR RAW RESULTS) ---
    // 1. Paywalled
    /*
    if (fullText.includes('subscribe to read') || fullText.includes('paywall') || fullText.includes('access denied') || title.includes('subscription')) {
        console.log(`Rejecting ${article.url}: Paywalled`);
        return null;
    }

    // 2. Anti-cannabis propaganda (heuristic)
    if (fullText.includes('cannabis is dangerous') || fullText.includes('should remain illegal') || fullText.includes('marijuana psychosis epidemic')) {
        console.log(`Rejecting ${article.url}: Anti-cannabis propaganda`);
        return null;
    }

    // 3. Press Releases (unless significant)
    // "Pure press releases from companies" -> check for PR Newswire, Business Wire, "press release" in title
    if (title.includes('press release') || text.substring(0, 300).includes('press release') || text.includes('pr newswire') || text.includes('business wire')) {
         // Unless it's M&A or major earnings or major study
         if (!fullText.includes('acquisition') && !fullText.includes('merger') && !fullText.match(/\$\d+/) && !fullText.includes('clinical trial results')) {
             console.log(`Rejecting ${article.url}: Press Release`);
             return null;
         }
    }

    // 5. Too short / no substance
    if (content.length < 300) {
        console.log(`Rejecting ${article.url}: Too short (${content.length} chars)`);
        return null;
    }
    */

    // --- CATEGORIZATION RULES ---

    // Helper to add category
    const addCat = (cat, rank) => {
        categories.add(cat);
        // If already has Y, keep Y. If YM, upgrade to Y if new is Y.
        if (!ranks[cat] || ranks[cat] === 'YM') {
            ranks[cat] = rank;
        }
    };

    // 1. THC Newsletter (Column I)
    // Covers: Rec/Med legalization, policy, industry, culture, science, consumer trends.
    // Exclude: Local ordinances, small busts, intl busts, anti-cannabis.
    const thcKeywords = ['marijuana', 'cannabis', 'legalization', 'legalize', 'dispensary', 'adult-use', 'recreational', 'potency', 'strain', 'rescheduling', 'descheduling', 'safer banking'];
    const thcMatch = thcKeywords.filter(k => fullText.includes(k)).length;

    const psychKeywords = ['psychedelic', 'psilocybin', 'magic mushroom', 'mdma', 'ketamine'];
    const psychMatch = psychKeywords.filter(k => fullText.includes(k)).length;

    if (thcMatch >= 2 || psychMatch >= 1) {
        // Exclusion: "Local city ordinances"
        if (!fullText.includes('city council') && !fullText.includes('zoning board') && !fullText.includes('planning commission')) {
            addCat('THC', thcMatch >= 3 ? 'Y' : 'YM');
        }
    }

    // 2. CBD Newsletter (Column J)
    // Covers: Hemp farming, CBD products, Delta-8/10, THCA, CBG, CBN, hemp supply chain.
    // Exclude: Ads, generic "CBD helps X", pure PR.
    const cbdKeywords = ['hemp', 'cbd', 'cannabidiol', 'delta-8', 'delta-10', 'thca', 'cbg', 'cbn', 'farm bill', 'usda hemp'];
    const cbdMatch = cbdKeywords.filter(k => fullText.includes(k)).length;

    if (cbdMatch >= 1) {
        // Edge Case: CBD from marijuana = THC or Med, NOT CBD.
        // If "marijuana" is dominant, it might not be CBD newsletter.
        // But if it mentions "hemp-derived", it IS CBD newsletter.
        if (fullText.includes('hemp-derived') || fullText.includes('farm bill')) {
            addCat('CBD', 'Y');
        } else if (fullText.includes('marijuana') && !fullText.includes('hemp')) {
             // Likely THC/Med
             addCat('THC', 'YM');
        } else {
            addCat('CBD', cbdMatch >= 2 ? 'Y' : 'YM');
        }
    }

    // 3. INV Newsletter (Column K)
    // Covers: M&A, stocks, fundraising, major operator news, international news.
    // Exclude: Small PR, local revenue.
    const invKeywords = ['merger', 'acquisition', 'stock', 'invest', 'revenue', 'profit', 'earnings', 'capital', 'funding', 'raise', 'ipo', 'nasdaq', 'nyse', 'tsx', 'cse', 'mso', 'multi-state operator'];
    const invMatch = invKeywords.filter(k => fullText.includes(k)).length;

    // International news goes here
    const intlKeywords = ['germany', 'canada', 'europe', 'australia', 'colombia', 'thailand', 'international'];
    const intlMatch = intlKeywords.filter(k => fullText.includes(k)).length;

    if (invMatch >= 1 || (intlMatch >= 1 && fullText.includes('cannabis'))) {
        if (fullText.includes('acquisition') || fullText.includes('merger') || fullText.includes('raise') || fullText.includes('funding')) {
             addCat('INV', 'Y');
        } else {
            addCat('INV', invMatch >= 2 ? 'Y' : 'YM');
        }
    }

    // 4. MED Newsletter (Column E)
    // Covers: Opioid crisis, clinical trials, research, patient access, FDA.
    // Exclude: Future studies, anti-cannabis scares.
    const medKeywords = ['clinical trial', 'study', 'research', 'patient', 'treatment', 'disease', 'cancer', 'epilepsy', 'pain', 'autism', 'ptsd', 'opioid', 'fentanyl', 'overdose', 'fda', 'nih'];
    const medMatch = medKeywords.filter(k => fullText.includes(k)).length;

    if (medMatch >= 2) {
        if (fullText.includes('results') || fullText.includes('findings') || fullText.includes('published in') || fullText.includes('journal')) {
            addCat('MED', 'Y');
        } else {
             addCat('MED', 'YM');
        }
    }

    article.categories = Array.from(categories);
    article.ranks = ranks;
    return article;
};

// POST /api/articles/upload - Handle Excel Upload
router.post('/upload', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const newsletterName = req.body.newsletterName || 'Week 1';

        const workbook = xlsx.read(req.file.buffer, { type: 'buffer', cellDates: true });
        const sheetName = workbook.SheetNames[0];
        if (!sheetName) return res.status(400).json({ error: 'Excel file has no sheets' });
        const sheet = workbook.Sheets[sheetName];
        const rawData = xlsx.utils.sheet_to_json(sheet, { defval: '', raw: false });

        const isRowEmpty = (row) => {
            const t = getCell(row, 'Title', 'title', 'Article', 'article');
            const u = getCell(row, 'URL', 'url', 'Link', 'link');
            return !t && !u;
        };
        const nonEmpty = rawData.filter(row => !isRowEmpty(row));
        const articles = nonEmpty.map((row, index) => cleanArticleData(row, index));

        if (articles.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'No articles found. Ensure the sheet has a header row and columns like Title, URL (or Article, Link). Download the template for the expected format.',
            });
        }

        console.log(`Processed ${articles.length} articles from Excel for "${newsletterName}"`);
        res.json({
            success: true,
            newsletterName,
            source: 'excel',
            count: articles.length,
            articles,
        });
    } catch (error) {
        console.error('Error processing Excel:', error);
        res.status(500).json({ success: false, error: error.message || 'Failed to process Excel file' });
    }
});

// Helper to extract JSON from AI response
const extractJSON = (text) => {
    // Strip common wrappers from provider errors before parsing
    text = String(text || '').replace(/^Error:\s*/i, '').trim();

    // Remove markdown code blocks if present
    text = text.replace(/```json\s*/gi, '').replace(/```/g, '').trim();

    // Extract and parse complete JSON objects from text, ignoring truncated tails.
    const extractObjectsFromText = (source) => {
        const objects = [];
        let start = -1;
        let depth = 0;
        let inString = false;
        let escaped = false;

        for (let i = 0; i < source.length; i++) {
            const ch = source[i];

            if (inString) {
                if (escaped) {
                    escaped = false;
                } else if (ch === '\\') {
                    escaped = true;
                } else if (ch === '"') {
                    inString = false;
                }
                continue;
            }

            if (ch === '"') {
                inString = true;
                continue;
            }

            if (ch === '{') {
                if (depth === 0) start = i;
                depth++;
                continue;
            }

            if (ch === '}') {
                if (depth > 0) depth--;
                if (depth === 0 && start >= 0) {
                    const candidate = source.slice(start, i + 1);
                    try {
                        objects.push(JSON.parse(candidate));
                    } catch (e) { /* skip invalid object */ }
                    start = -1;
                }
            }
        }

        return objects;
    };

    // 1. Direct parse
    try {
        return JSON.parse(text);
    } catch (e) { /* continue */ }

    // 2. Find JSON array within text
    const match = text.match(/\[([\s\S]*)\]/);
    if (match) {
        try { return JSON.parse(match[0]); } catch (e2) { /* continue */ }
        try { return JSON.parse(match[0] + ']'); } catch (e3) { /* continue */ }
        try { return JSON.parse(match[0] + '}]'); } catch (e4) { /* continue */ }

        // 3. Extract individual JSON objects from within the array
        const objects = extractObjectsFromText(match[0]);
        if (objects.length > 0) return objects;
    }

    // 3b. Handle truncated arrays with no closing bracket.
    const firstArrayBracket = text.indexOf('[');
    if (firstArrayBracket !== -1) {
        const arrayTail = text.slice(firstArrayBracket);
        const objects = extractObjectsFromText(arrayTail);
        if (objects.length > 0) return objects;
    }

    // 4. Last resort: parse markdown-formatted article list
    const articles = [];
    const titleRegex = /###?\s*\d+\.\s*(.+)/g;
    const urlRegex = /\[Read more\]\((https?:\/\/[^\s)]+)\)/gi;
    const dateRegex = /\*\*Date:\*\*\s*(\d{2}\/\d{2}\/\d{2})/g;

    const titles = [...text.matchAll(titleRegex)].map(m => m[1].trim());
    const urls = [...text.matchAll(urlRegex)].map(m => m[1].trim());
    const dates = [...text.matchAll(dateRegex)].map(m => m[1].trim());

    if (titles.length > 0 && urls.length > 0) {
        console.log(`extractJSON: Falling back to markdown parser — found ${titles.length} titles, ${urls.length} urls`);
        for (let i = 0; i < Math.min(titles.length, urls.length); i++) {
            articles.push({
                title: titles[i],
                url: urls[i],
                description: '',
                date: dates[i] || '',
            });
        }
        return articles;
    }

    throw new Error('Could not extract JSON or structured data from AI response');
};

// Shared Model Mapping
const MODEL_MAPPING = {
    'claude-opus-4-8': 'claude-opus-4-8',
    'claude-opus-4-7': 'claude-opus-4-7',
    'claude-opus-4-7-extended': 'claude-opus-4-7',
    'claude-opus-4-6': 'claude-opus-4-6',
    'claude-opus-4-6-extended': 'claude-opus-4-6',
    'claude-sonnet-4-6': 'claude-sonnet-4-6',
    'claude-haiku-4-5': 'claude-haiku-4-5-20251001',
    'gemini-flash-3-0': 'gemini-3-flash-preview',
    'gemini-3-1-pro': 'gemini-3.1-pro-preview',
    'gemini-flash-3-5': 'gemini-3.5-flash',
};

// Helper to get API Model ID
const getApiModelId = (userModel) => MODEL_MAPPING[userModel] || userModel || 'claude-opus-4-7';

function isExtendedModel(userModel) {
    return String(userModel || '').includes('-extended');
}

/** Anthropic article-search limits (override via .env). */
function getAnthropicSearchConfig(userModel) {
    const apiModel = getApiModelId(userModel);
    const extended = isExtendedModel(userModel);
    const maxWebUses = parseInt(
        process.env[extended ? 'ARTICLE_SEARCH_MAX_WEB_USES_EXTENDED' : 'ARTICLE_SEARCH_MAX_WEB_USES']
            || (extended ? '40' : '25'),
        10,
    );
    const maxTokens = parseInt(
        process.env[extended ? 'ARTICLE_SEARCH_MAX_TOKENS_EXTENDED' : 'ARTICLE_SEARCH_MAX_TOKENS']
            || (extended ? '32000' : '16000'),
        10,
    );
    const useDynamicWebSearch = /opus-4-[678]|sonnet-4-6/.test(apiModel);
    const request = {
        model: apiModel,
        max_tokens: maxTokens,
        tools: [{
            type: useDynamicWebSearch ? 'web_search_20260209' : 'web_search_20250305',
            name: 'web_search',
            max_uses: maxWebUses,
        }],
    };
    if (extended && /opus-4-[678]|sonnet-4-6/.test(apiModel)) {
        request.thinking = { type: 'adaptive' };
        request.output_config = {
            effort: /opus-4-[78]/.test(apiModel) ? 'xhigh' : 'high',
        };
    }
    return request;
}

function getAnthropicTextContent(message) {
    if (!message || !Array.isArray(message.content)) return '';
    return message.content
        .filter((block) => block.type === 'text')
        .map((block) => block.text)
        .join('\n');
}

function sanitizeArticlesForModify(articles) {
    return (articles || []).map((a) => ({
        title: a.title || '',
        description: a.description || '',
        url: a.url || '',
        date: a.date || '',
    }));
}

function resolveAiProvider(model) {
    let apiModel = getApiModelId(model);
    let isOpenRouter = false;

    if (apiModel.startsWith('openrouter-')) {
        isOpenRouter = true;
        apiModel = apiModel.replace('openrouter-', '');
    }

    const isGemini = apiModel.toLowerCase().includes('gemini');
    
    // We now require Gemini for Phase 1 web searching regardless of the selected model
    if (!process.env.GEMINI_API_KEY && !process.env.GOOGLE_API_KEY) {
        return {
            error: 'GEMINI_API_KEY is not configured on the server. It is required for the web search engine. Add it in Vercel.',
        };
    }
    
    if (isOpenRouter && !process.env.OPENROUTER_API_KEY) {
        return {
            error: 'OPENROUTER_API_KEY is not configured on the server. Add it in Vercel → Settings → Environment Variables.',
        };
    }

    if (!isGemini && !isOpenRouter && !process.env.ANTHROPIC_API_KEY) {
        return {
            error: 'ANTHROPIC_API_KEY is not configured on the server. Add it in Vercel → Settings → Environment Variables.',
        };
    }
    return { apiModel, isGemini, isOpenRouter };
}

async function mapWithConcurrency(items, limit, fn) {
    const results = new Array(items.length);
    let nextIndex = 0;
    async function worker() {
        while (nextIndex < items.length) {
            const i = nextIndex++;
            results[i] = await fn(items[i], i);
        }
    }
    const workers = Math.min(limit, items.length);
    await Promise.all(Array.from({ length: workers }, worker));
    return results;
}

const ERROR_LOG_DIR = process.env.VERCEL ? '/tmp' : __dirname;

// Helper to extract clean error message from AI providers
function parseAIError(error) {
    let message = error.message || 'Unknown error occurred';

    // Check if message looks like an HTTP error with JSON body (common with Anthropic SDK)
    // e.g. "400 {"type":"error","error":{"type":"invalid_request_error","message":"..."}}"
    if (/^\d{3}\s+\{/.test(message)) {
         try {
             const jsonPart = message.substring(message.indexOf('{'));
             const parsed = JSON.parse(jsonPart);
             if (parsed.error && parsed.error.message) {
                 return parsed.error.message;
             }
         } catch (e) {
             // Parsing failed, return original
         }
    }

    // Check for nested error object
    if (error.error && error.error.message) {
        return error.error.message;
    }

    return message;
}

function buildAiErrorResponse(error, model) {
    const message = parseAIError(error);
    const modelLabel = model ? ` [model: ${model}]` : '';
    const body = { error: message, details: error.message, model: model || null };
    if (/credit balance is too low/i.test(message)) {
        body.errorCode = 'anthropic_credits_low';
        body.error = `Anthropic (Claude) API credits are too low${modelLabel}.`;
    } else if (/quota exceeded/i.test(message)) {
        body.errorCode = 'quota_exceeded';
        body.error = `API quota exceeded${modelLabel}.`;
    } else if (error.status === 429) {
        body.error = `Rate limit or quota exceeded${modelLabel}.`;
    }
    return body;
}

// POST /api/articles/search - AI Search & Filtering
router.post('/search', async (req, res) => {
    try {
        const { prompt, newsletterName, model, existingUrls } = req.body || {};
        if (!prompt || !String(prompt).trim()) {
            return res.status(400).json({ error: 'Please enter a search prompt.' });
        }

        const provider = resolveAiProvider(model);
        if (provider.error) {
            return res.status(503).json({ error: provider.error, configured: false });
        }

        console.log(`Received search request: "${prompt}" for ${newsletterName} using model ${model}`);

        // Use mock data if requested (for testing without burning credits)
        if (String(prompt).toLowerCase().includes('mock data')) {
             console.log("Mock data requested.");
             return res.json({
                 success: true,
                 articles: [
                     { title: "Mock Article 1", description: "This is a test article.", url: "https://example.com/1", category: "MED" },
                     { title: "Mock Article 2", description: "Another test article.", url: "https://example.com/2", category: "THC" },
                 ]
             });
        }

        console.log(`Searching articles with model ${model} for "${newsletterName}"`);

        const { apiModel, isGemini } = provider;

        console.log(`Using model mapping: ${model} -> ${apiModel}`);

        let content = '';

        const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
        
        // --- PHASE 1: WEB SEARCH (GEMINI) ---
        console.log(`Phase 1: Fetching raw search results using Gemini Search Engine`);
        let rawSearchResults = "";
        try {
            // Phase 1 ALWAYS uses Gemini for Google Search Grounding.
            // We use the 'gemini-3.1-pro-preview' equivalent for this step since it supports tools.
            const searchModel = genAI.getGenerativeModel({
                model: 'gemini-3.1-pro-preview',
                tools: [{ googleSearch: {} }],
            });
            let existingUrlText = '';
            if (existingUrls && existingUrls.length > 0) {
                existingUrlText = `\nCRITICAL ANTI-DUPLICATION RULE: The user already has the following articles in their newsletter. You MUST NOT include these articles, and you MUST NOT include any articles from different publishers that cover the exact same story/topic. Find NEW stories only:\n${existingUrls.join('\n')}\n`;
            }

            const searchPrompt = `You are a research assistant. Today's date is ${today}. 
Search the web for news articles matching the following user request: "${prompt}"
${existingUrlText}
CRITICAL DATE RULE: If the user specifies a date range or cutoff (e.g. "after June 1st, 2026"), you MUST strictly enforce it. Only include articles published within that date range. Do NOT include articles outside that range. Verify the publication date before including each article.

CRITICAL URL RULE: You MUST provide the full, raw URL string starting with http:// or https://. DO NOT use citation footnotes like [1] or [2]. If the Google Search tool provides a "vertexaisearch.cloud.google.com" redirect link, YOU MUST USE THAT EXACT LINK. DO NOT try to guess, hallucinate, or reverse-engineer the original publisher URL, as that leads to broken links. Output the vertexaisearch link exactly as you received it.

SOURCE & DIVERSITY RULE: Prioritize checking well-known industry sources such as mjbizdaily.com, norml.org, and ganjapreneur.com. However, ensure source diversity. Do not include more than 2-3 articles from any single source unless the information is highly unique and cannot be found elsewhere.

Please return a comprehensive list of the articles you found, including their titles, exact URLs from the search results, a short description of each, and their publication dates.`;

            const searchResult = await searchModel.generateContent(searchPrompt);
            console.log("Gemini search response object:", JSON.stringify(searchResult.response, null, 2));
            rawSearchResults = await searchResult.response.text();
            console.log("Phase 1 Complete. Raw search results fetched.");
        } catch (searchErr) {
            console.error('Phase 1 Search Error:', searchErr);
            return res.status(500).json(buildAiErrorResponse(searchErr));
        }

        // --- PHASE 2: JSON EXTRACTION (SELECTED MODEL) ---
        console.log(`Phase 2: Extracting JSON using model ${model}`);
        const extractPrompt = `You are a data extraction assistant. I have performed a web search for articles based on this user request: "${prompt}"
        
Here are the raw search results:
---
${rawSearchResults}
---

Your task is to parse these results and return a single valid JSON array containing the articles. 
No markdown, no headers, no commentary, no explanation before or after.

Each object in the array must have exactly these keys:
- "title": article headline
- "url": full article URL (use the exact URL provided in the search results)
- "description": 1-2 sentence summary
- "date": publication date in MM/DD/YY format (leave empty string if unknown)

Example format:
[{"title":"...","url":"https://...","description":"...","date":"06/05/26"}]`;

        if (isGemini) {
            try {
                const geminiModel = genAI.getGenerativeModel({ model: apiModel });
                const result = await geminiModel.generateContent(extractPrompt);
                content = await result.response.text();
            } catch (geminiError) {
                console.error('Gemini API Error:', geminiError);
                return res.status(500).json(buildAiErrorResponse(geminiError));
            }
        } else if (provider.isOpenRouter) {
            try {
                const response = await openrouter.chat.completions.create({
                    model: apiModel,
                    messages: [
                        { role: 'system', content: "You are a data extraction assistant that only outputs valid JSON arrays. No markdown, no conversational text." },
                        { role: 'user', content: extractPrompt }
                    ],
                }, { timeout: 300000 });
                content = response.choices[0]?.message?.content || '';
            } catch (openrouterError) {
                console.error('OpenRouter API Error:', openrouterError);
                return res.status(500).json(buildAiErrorResponse(openrouterError));
            }
        } else {
            try {
                const message = await anthropic.messages.create({
                    model: apiModel,
                    max_tokens: 8000,
                    system: "You are a data extraction assistant that only outputs valid JSON arrays. No markdown, no conversational text.",
                    messages: [
                        { role: 'user', content: extractPrompt },
                    ],
                }, { timeout: 300000 });

                content = message.content
                    .filter(block => block.type === 'text')
                    .map(block => block.text)
                    .join('\n');
            } catch (anthropicError) {
                console.error('Anthropic API Error:', anthropicError);
                return res.status(500).json(buildAiErrorResponse(anthropicError));
            }
        }

        let rawArticles = [];
        try {
            rawArticles = extractJSON(content);
        } catch (e) {
            const logId = Date.now();
            console.error(`[${logId}] Failed to parse AI JSON response:`, content.substring(0, 500) + "...");
            // Write full content to file for debugging
            try {
                const logPath = path.join(ERROR_LOG_DIR, `error_json_${logId}.log`);
                fs.writeFileSync(logPath, content);
                console.error(`Full error content written to ${logPath}`);
            } catch (fsErr) {
                console.error('Failed to write error log file', fsErr);
            }

            return res.status(500).json({
                error: "AI needs more detail before it can continue.",
                details: String(content || '').trim(),
                logId
            });
        }

        console.log(`AI found ${rawArticles.length} articles. Starting Stage 2: Verification & Categorization...`);

        // Stage 2: Verification & Categorization
        const processArticle = async (article) => {
            // Clean first
            let cleaned = cleanArticleData(article, 0);

            // 1. Verify URL
            if (!cleaned.url || cleaned.url.includes('example.com') || cleaned.url === '#') {
                return null;
            }

            const { isValid, isReadable, content, finalUrl } = await verifyAndAnalyzeUrl(cleaned.url);

            if (!isValid) {
                console.log(`Skipping invalid URL (failed verification): ${cleaned.url}`);
                return null;
            }
            
            if (finalUrl) {
                cleaned.url = finalUrl;
            }

            // Simple check: does content length > 300 chars?
            if (isReadable && content.length < 300) {
                 console.log(`Skipping thin content (${content.length} chars): ${cleaned.url}`);
                 return null;
            }

            // 2. Categorize (and apply rejection rules from brief)
            if (isReadable) {
                // categorizeArticle now implements the brief's logic
                cleaned = categorizeArticle(cleaned, content);

                if (!cleaned) {
                    console.log(`Skipping rejected article (rule violation): ${article.url}`);
                    return null;
                }
            } else {
                // If not readable, keep it but warn
                console.log(`Content unreadable for ${cleaned.url}, skipping auto-categorization but keeping.`);
            }

            return cleaned;
        };

        const results = await mapWithConcurrency(rawArticles, 4, processArticle);

        // Filter out nulls (rejected articles)
        const validArticles = results.filter(a => a !== null);

        // Re-index
        const finalArticles = validArticles.map((a, i) => ({ ...a, id: i + 1 }));

        console.log(`Returning ${finalArticles.length} valid articles after categorization.`);

        res.json({
            success: true,
            newsletterName,
            source: 'ai',
            count: finalArticles.length,
            articles: finalArticles,
        });

    } catch (error) {
        console.error('Error with AI Search:', error);
        res.status(500).json(buildAiErrorResponse(error, model));
    }
});

const MODIFY_MAX_PER_REQUEST = 12;

function isTitleFocusedModifyPrompt(prompt) {
    const p = String(prompt || '').toLowerCase();
    return p.includes('title') && !p.includes('description') && !p.includes('summary');
}

// POST /api/articles/modify - Handle AI Article Modification
router.post('/modify', async (req, res) => {
    try {
        const { prompt, articles, model, titleOnly } = req.body || {};

        if (!prompt || !String(prompt).trim()) {
            return res.status(400).json({ error: 'Please enter a modification instruction.' });
        }
        if (!Array.isArray(articles) || articles.length === 0) {
            return res.status(400).json({ error: 'Select at least one article (Select column) to modify.' });
        }
        if (articles.length > MODIFY_MAX_PER_REQUEST) {
            return res.status(400).json({
                error: `Too many articles in one request (${articles.length}). The app sends 8 at a time automatically.`,
            });
        }

        const provider = resolveAiProvider(model);
        if (provider.error) {
            return res.status(503).json({ error: provider.error, configured: false });
        }

        const titleFocused = titleOnly === true
            || (titleOnly !== false && isTitleFocusedModifyPrompt(prompt));

        const inputArticles = titleFocused
            ? articles.map((a, i) => ({
                _batchIndex: i,
                title: a.title || '',
            }))
            : sanitizeArticlesForModify(articles);

        const { apiModel, isGemini } = provider;
        const maxTokens = Math.min(16000, 800 + inputArticles.length * (titleFocused ? 120 : 400));

        console.log(
            `Modifying ${inputArticles.length} articles (${titleFocused ? 'titles only' : 'full'}) `
            + `tokens~${maxTokens} model: ${model} -> ${apiModel}`,
        );

        const systemPrompt = titleFocused
            ? `You are a professional newsletter editor. Modify ONLY article titles per the user's instructions.

Return ONLY a valid JSON array with the same number of items in the same order.
Each object: {"title":"..."} only. Keep URLs and descriptions unchanged (do not include them).
No markdown, no code fences, no commentary.`
            : `You are a professional editor for a newsletter. Modify the provided articles based on the user's instructions.

Return ONLY a valid JSON array with the same number of items in the same order as the input.
Each object must have exactly these keys: "title", "description", "url", "date".
Do not add or remove articles. No markdown, no code fences, no commentary.`;

        const userMessage = `Instruction: ${String(prompt).trim()}\n\nArticles:\n${JSON.stringify(inputArticles, null, 2)}`;

        let content = '';

        if (provider.isOpenRouter) {
            try {
                const response = await openrouter.chat.completions.create({
                    model: apiModel,
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: userMessage }
                    ],
                }, { timeout: 300000 });
                content = response.choices[0]?.message?.content || '';
            } catch (openrouterError) {
                console.error('OpenRouter API Error:', openrouterError);
                return res.status(500).json(buildAiErrorResponse(openrouterError, apiModel));
            }
        } else if (isGemini) {
            try {
                const geminiModel = genAI.getGenerativeModel({ model: apiModel });
                const result = await geminiModel.generateContent(`${systemPrompt}\n\n${userMessage}`);
                const response = await result.response;
                content = response.text();
            } catch (geminiError) {
                console.error('Gemini API Error:', geminiError);
                return res.status(500).json(buildAiErrorResponse(geminiError, apiModel));
            }
        } else {
            try {
                const message = await anthropic.messages.create({
                    model: apiModel,
                    max_tokens: maxTokens,
                    system: systemPrompt,
                    messages: [
                        { role: 'user', content: userMessage },
                    ],
                }, { timeout: 300000 });
                content = getAnthropicTextContent(message);
                if (!content.trim()) {
                    return res.status(500).json({
                        error: 'AI returned an empty response. Try again or use Claude Sonnet.',
                    });
                }
            } catch (anthropicError) {
                console.error('Anthropic API Error:', anthropicError);
                return res.status(500).json(buildAiErrorResponse(anthropicError, apiModel));
            }
        }

        let modifiedArticles = [];
        try {
            modifiedArticles = extractJSON(content);
            if (!Array.isArray(modifiedArticles)) {
                modifiedArticles = modifiedArticles ? [modifiedArticles] : [];
            }
        } catch (e) {
            console.error('Failed to parse AI JSON response:', content);
            const logId = Date.now();
            try {
                const logPath = path.join(ERROR_LOG_DIR, `error_log_${logId}.txt`);
                fs.writeFileSync(logPath, String(content || ''));
            } catch (fsErr) {
                console.error('Failed to write error log file', fsErr);
            }
            return res.status(500).json({
                error: 'AI could not return valid JSON. Try a shorter instruction or fewer articles.',
                details: String(content || '').trim().slice(0, 2000),
                logId,
            });
        }

        if (modifiedArticles.length !== inputArticles.length) {
            console.warn(
                `Modify count mismatch: sent ${inputArticles.length}, got ${modifiedArticles.length}. Aligning by index.`,
            );
            if (modifiedArticles.length > inputArticles.length) {
                modifiedArticles = modifiedArticles.slice(0, inputArticles.length);
            } else {
                while (modifiedArticles.length < inputArticles.length) {
                    const i = modifiedArticles.length;
                    modifiedArticles.push(titleFocused ? { title: inputArticles[i].title } : { ...inputArticles[i] });
                }
            }
        }

        modifiedArticles = modifiedArticles.map(a => {
            const normalized = { ...a };
            if (!normalized.title) {
                const altTitleKey = Object.keys(normalized).find(k => k.toLowerCase().includes('title') || k.toLowerCase().includes('headline'));
                if (altTitleKey) normalized.title = normalized[altTitleKey];
            }
            if (!normalized.description && !titleFocused) {
                const altDescKey = Object.keys(normalized).find(k => k.toLowerCase().includes('description') || k.toLowerCase().includes('summary'));
                if (altDescKey) normalized.description = normalized[altDescKey];
            }
            return normalized;
        });


        const sourceArticles = sanitizeArticlesForModify(articles);

        console.log(`Successfully modified ${modifiedArticles.length} articles.`);

        res.json({
            success: true,
            articles: modifiedArticles.map((a, i) => ({
                title: a.title != null ? String(a.title) : (titleFocused ? sourceArticles[i].title : inputArticles[i].title),
                description: titleFocused
                    ? sourceArticles[i].description
                    : (a.description != null ? String(a.description) : sourceArticles[i].description),
                url: titleFocused
                    ? sourceArticles[i].url
                    : (a.url != null ? String(a.url) : sourceArticles[i].url),
                date: titleFocused
                    ? sourceArticles[i].date
                    : (a.date != null ? String(a.date) : sourceArticles[i].date),
            })),
        });

    } catch (error) {
        console.error('Error modifying articles:', error);
        res.status(500).json(buildAiErrorResponse(error, model));
    }
});

// POST /api/articles/summarize - Generate Summaries (supports Anthropic or Gemini)
router.post('/summarize', async (req, res) => {
    try {
        const { prompt, useRules, summaryRules, category, model, articles } = req.body;

        if (!prompt) {
            return res.status(400).json({ error: 'Prompt is required' });
        }
        if (!Array.isArray(articles) || articles.length === 0) {
            return res.status(400).json({ error: 'Articles are required for category summary generation' });
        }

        const provider = resolveAiProvider(model);
        if (provider.error) {
            return res.status(503).json({ error: provider.error });
        }
        const { apiModel, isGemini, isOpenRouter } = provider;

        console.log(`Generating summaries for ${category} with rules: ${useRules} (${isGemini ? 'Gemini' : (isOpenRouter ? 'OpenRouter' : 'Claude')})`);

        // Load base prompt from config file (editable via UI) with hardcoded fallback
        let systemPrompt;
        try {
            const promptFile = path.join(__dirname, '../config/summary_base_prompt.txt');
            systemPrompt = fs.existsSync(promptFile) ? fs.readFileSync(promptFile, 'utf8').trim() : '';
        } catch (_) { systemPrompt = ''; }
        if (!systemPrompt) {
            systemPrompt = `You are a professional newsletter editor. Create a newsletter-ready summary for the provided category articles only.\n\nWrite exactly 6 to 7 short lines total.\nEach line should be concise, natural, and publication-ready.\nOnly use the fetched article content and article metadata provided by the user.\nDo not use outside knowledge.\nDo not mention URLs in the output.\nFocus on the most important developments across the provided articles for the selected category.\nIf some links could not be accessed, briefly note that in one short line.`;
        }

        if (useRules && summaryRules && summaryRules.trim()) {
            systemPrompt += `\n\nHere are the specific rules you MUST follow:\n${summaryRules}`;
        } else if (useRules) {
            try {
                const fs = require('fs');
                const path = require('path');
                const rulesPath = path.join(__dirname, '../newsletter_summary_rules.md');
                if (fs.existsSync(rulesPath)) {
                    const rules = fs.readFileSync(rulesPath, 'utf8');
                    systemPrompt += `\n\nHere are the specific rules you MUST follow:\n${rules}`;
                }
            } catch (err) {
                console.error('Failed to read rules file:', err);
            }
        }
        
        // Always enforce no conversational filler, even if the user overwrote the base prompt
        systemPrompt += `\n\nCRITICAL INSTRUCTION: Output ONLY the newsletter content itself. Do NOT include any conversational filler, greetings, or introductory phrases such as "Here is your summary paragraph:" or "Here's the summary:".`;

        const articleInputs = articles.map(a => ({
            title: a.title || '',
            url: a.url || '',
            date: a.date || '',
            description: a.description || '',
        }));

        const fetchedArticles = await Promise.all(articleInputs.map(async (article) => {
            const inspected = await verifyAndAnalyzeUrl(article.url);
            return {
                ...article,
                accessible: !!inspected.isValid,
                readable: !!inspected.isReadable,
                content: inspected.content || '',
            };
        }));

        // Check for unreadable articles and accept manual content override
        const { manualContent } = req.body;
        const unreadableArticles = fetchedArticles
            .map((article, index) => ({
                ...article,
                index: index + 1,
            }))
            .filter(article => !article.readable);

        // If there are unreadable articles and no manual content provided, ask the user to provide it
        if (unreadableArticles.length > 0 && !manualContent) {
            return res.status(400).json({
                success: false,
                error: `${unreadableArticles.length} article(s) could not be fetched`,
                unreadableArticles: unreadableArticles.map(a => ({
                    index: a.index,
                    title: a.title,
                    url: a.url,
                    date: a.date,
                })),
                needsManualContent: true,
            });
        }

        // Merge manual content with fetched content
        const articlePayload = fetchedArticles.map((article, index) => {
            const manualEntry = manualContent && manualContent[index];
            return {
                index: index + 1,
                title: article.title,
                url: article.url,
                date: article.date,
                description: article.description,
                accessible: article.accessible,
                readable: article.readable,
                content: manualEntry || (article.content ? article.content.substring(0, 6000) : ''),
            };
        });

        const userMessage = [
            `Category: ${category}`,
            'User prompt:',
            prompt,
            '',
            'Fetched articles:',
            JSON.stringify(articlePayload, null, 2),
        ].join('\n');

        let content = '';
        if (isGemini) {
            const geminiModel = genAI.getGenerativeModel({ model: apiModel });
            const fullPrompt = `${systemPrompt}\n\nUser content to summarize:\n\n${userMessage}`;
            const result = await geminiModel.generateContent(fullPrompt);
            content = result.response.text();
        } else if (isOpenRouter) {
            const response = await openrouter.chat.completions.create({
                model: apiModel,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userMessage }
                ],
            });
            content = response.choices[0]?.message?.content || '';
        } else {
            const message = await anthropic.messages.create({
                model: apiModel,
                max_tokens: 4000,
                system: systemPrompt,
                messages: [
                    { role: "user", content: userMessage },
                ],
            });
            content = message.content[0].text;
        }

        res.json({
            success: true,
            resultText: content
        });

    } catch (error) {
        console.error('Error generating summaries:', error);
        res.status(500).json({ error: 'Failed to generate summaries', details: error.message });
    }
});

router.post('/generate-subjects', async (req, res) => {
    try {
        const { prompt, categories, model } = req.body || {};
        if (!prompt || !String(prompt).trim()) {
            return res.status(400).json({ error: 'Prompt is required' });
        }
        if (!categories || typeof categories !== 'object') {
            return res.status(400).json({ error: 'Categories payload is required' });
        }

        const hasGemini = !!(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY);
        if (!hasGemini) {
            return res.status(503).json({ error: 'GEMINI_API_KEY not configured for subject generation.' });
        }

        const normalized = {};
        ['MED', 'THC', 'CBD', 'INV'].forEach((category) => {
            const items = Array.isArray(categories[category]) ? categories[category] : [];
            normalized[category] = items.slice(0, 3).map((article, index) => ({
                index: index + 1,
                title: article.title || '',
                url: article.url || '',
                date: article.date || '',
                description: article.description || '',
            }));
        });

        const systemPrompt = `You are an expert email copywriter for newsletter subject lines.

Generate one short, highly clickable email subject for each category: MED, THC, CBD, INV.
Use only the provided articles.
Use suitable emojis as separators between the main hooks.
Keep each subject on a single line.
Make each subject concise and compelling.
Format the text of the subjects in Title Case.
If the same article or same core story appears in multiple categories, use the same wording and emoji treatment for that repeated idea.
Return only valid JSON with keys MED, THC, CBD, INV.`;

        const userMessage = [
            'User instructions:',
            String(prompt).trim(),
            '',
            'Category articles:',
            JSON.stringify(normalized, null, 2),
        ].join('\n');

        const requestedModel = String(model || '').toLowerCase();
        const geminiModelId = requestedModel.includes('gemini')
            ? getApiModelId(model || 'gemini-flash-3-0')
            : getApiModelId('gemini-flash-3-0');
        const geminiModel = genAI.getGenerativeModel({ model: geminiModelId });
        const fullPrompt = `${systemPrompt}\n\n${userMessage}`;
        const result = await geminiModel.generateContent(fullPrompt);
        const content = result.response.text().trim();
        const cleaned = content.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();

        let subjects;
        try {
            subjects = JSON.parse(cleaned);
        } catch (err) {
            return res.status(500).json({ error: 'Subject generator returned invalid JSON', details: cleaned });
        }

        res.json({
            success: true,
            subjects: {
                MED: String(subjects.MED || '').trim(),
                THC: String(subjects.THC || '').trim(),
                CBD: String(subjects.CBD || '').trim(),
                INV: String(subjects.INV || '').trim(),
            },
        });
    } catch (error) {
        console.error('Error generating subjects:', error);
        res.status(500).json({ error: 'Failed to generate subjects', details: error.message });
    }
});

router.get('/error-log/:logId', async (req, res) => {
    try {
        const logId = String(req.params.logId || '').trim();
        if (!/^\d+$/.test(logId)) {
            return res.status(400).json({ error: 'Invalid log ID' });
        }

        const filename = `error_json_${logId}.log`;
        const filepath = path.join(process.cwd(), filename);
        if (!fs.existsSync(filepath)) {
            return res.status(404).json({ error: 'Log not found' });
        }

        const content = fs.readFileSync(filepath, 'utf8');
        return res.json({ success: true, logId, content });
    } catch (error) {
        console.error('Error reading AI parse log:', error);
        return res.status(500).json({ error: 'Failed to read log file' });
    }
});

// Route to resolve existing vertexaisearch URLs
router.post('/resolve-urls', express.json(), async (req, res) => {
    try {
        const { urls } = req.body;
        if (!Array.isArray(urls)) {
            return res.status(400).json({ error: 'urls must be an array' });
        }

        const resolved = {};
        await Promise.all(urls.map(async (url) => {
            if (url.includes('vertexaisearch.cloud.google.com')) {
                try {
                    const response = await fetch(url, { method: 'HEAD' });
                    resolved[url] = response.url;
                } catch (e) {
                    resolved[url] = url;
                }
            } else {
                resolved[url] = url;
            }
        }));

        res.json({ success: true, resolved });
    } catch (error) {
        console.error('Error resolving urls:', error);
        res.status(500).json({ error: 'Failed to resolve URLs' });
    }
});

// ── Summary base prompt config ────────────────────────────────────────────────
const BASE_PROMPT_PATH = path.join(__dirname, '../config/summary_base_prompt.txt');
const SUMMARY_RULES_PATH = path.join(__dirname, '../logs/newsletter_summary_rules.md');

router.get('/summary-base-prompt', (req, res) => {
    try {
        const text = fs.existsSync(BASE_PROMPT_PATH) ? fs.readFileSync(BASE_PROMPT_PATH, 'utf8') : '';
        res.json({ prompt: text });
    } catch (err) {
        res.status(500).json({ error: 'Failed to read base prompt' });
    }
});

router.post('/summary-base-prompt', express.json(), (req, res) => {
    try {
        const { prompt } = req.body;
        if (typeof prompt !== 'string') return res.status(400).json({ error: 'prompt must be a string' });
        fs.writeFileSync(BASE_PROMPT_PATH, prompt, 'utf8');
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to save base prompt' });
    }
});

router.get('/summary-rules', (req, res) => {
    try {
        const text = fs.existsSync(SUMMARY_RULES_PATH) ? fs.readFileSync(SUMMARY_RULES_PATH, 'utf8') : '';
        res.json({ rules: text });
    } catch (err) {
        res.status(500).json({ error: 'Failed to read summary rules' });
    }
});

router.post('/summary-rules', express.json(), (req, res) => {
    try {
        const { rules } = req.body;
        if (typeof rules !== 'string') return res.status(400).json({ error: 'rules must be a string' });
        fs.writeFileSync(SUMMARY_RULES_PATH, rules, 'utf8');
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to save summary rules' });
    }
});

module.exports = router;
