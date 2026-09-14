/**
 * Pull a requested article count and an explicit "after <date>" window out of the
 * user's search prompt so Phase 1 / verify follow the query instead of the
 * default 7-day / 25-result caps.
 */

const MONTHS = {
    january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
    july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
};

function pad2(n) {
    return String(n).padStart(2, '0');
}

function toIsoDate(year, monthIndex, day) {
    return `${year}-${pad2(monthIndex + 1)}-${pad2(day)}`;
}

function parsePromptSearchIntent(prompt) {
    const text = String(prompt || '');
    const countMatch = text.match(/\b(?:find|get|need|want)\s+(\d{1,3})\b/i)
        || text.match(/\b(\d{1,3})\s+articles?\b/i);
    let requestedCount = countMatch ? parseInt(countMatch[1], 10) : 0;
    if (!Number.isFinite(requestedCount) || requestedCount < 1) requestedCount = 0;
    if (requestedCount > 80) requestedCount = 80;

    let since = '';
    const afterNamed = text.match(/\bafter\s+([A-Za-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s*(\d{4}))?/i);
    if (afterNamed) {
        const monthIndex = MONTHS[afterNamed[1].toLowerCase()];
        const day = parseInt(afterNamed[2], 10);
        const year = parseInt(afterNamed[3], 10) || new Date().getFullYear();
        if (monthIndex !== undefined && day >= 1 && day <= 31) {
            const d = new Date(Date.UTC(year, monthIndex, day + 1));
            since = toIsoDate(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
        }
    } else {
        const afterIso = text.match(/\bafter\s+(\d{4})-(\d{2})-(\d{2})\b/i);
        if (afterIso) {
            const year = parseInt(afterIso[1], 10);
            const monthIndex = parseInt(afterIso[2], 10) - 1;
            const day = parseInt(afterIso[3], 10);
            const d = new Date(Date.UTC(year, monthIndex, day + 1));
            since = toIsoDate(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
        }
    }

    return { requestedCount, since, until: '' };
}

function youComQueryFromPrompt(prompt) {
    const { queries, intent } = youComQueriesFromPrompt(prompt);
    return { query: queries[0] || String(prompt || '').slice(0, 240), intent };
}

function youComQueriesFromPrompt(prompt) {
    const text = String(prompt || '').replace(/\s+/g, ' ').trim();
    const intent = parsePromptSearchIntent(text);
    const queries = [];
    if (/\bcannabis\b/i.test(text) || /\bmarijuana\b/i.test(text)) queries.push('cannabis news');
    if (/\bhemp\b/i.test(text) || /\bcbd\b/i.test(text)) queries.push('hemp CBD news');
    if (/\bpsychedelic/i.test(text) || /\bpsilocybin\b/i.test(text)) queries.push('psychedelic psilocybin news');
    if (!queries.length) queries.push(text.slice(0, 240));
    return { queries, intent };
}

module.exports = {
    parsePromptSearchIntent,
    youComQueryFromPrompt,
    youComQueriesFromPrompt,
};
