/**
 * Collapse same-story / different-site hits onto one professional row.
 * Works in Node (search) and in the browser (render / include alts).
 */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.StoryGroups = factory();
    }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    const SERVICE_HOSTS = [
        'leafly.com',
        'weedmaps.com',
        'dutchie.com',
        'iheartjane.com',
        'eaze.com',
        'iheartjane.io',
        'getleafly.com',
        'cookies.co',
        'trulieve.com',
        'sunnyside.shop',
        'flowhub.com',
        'treez.io',
    ];

    const LEGAL_HOSTS = [
        'norml.org',
        'mpp.org',
        'safeaccessnow.org',
    ];

    const HOST_RANK = [
        ['apnews.com', 100],
        ['reuters.com', 98],
        ['statnews.com', 94],
        ['politico.com', 93],
        ['nytimes.com', 92],
        ['washingtonpost.com', 91],
        ['wsj.com', 90],
        ['bbc.com', 88],
        ['npr.org', 87],
        ['cnn.com', 84],
        ['forbes.com', 82],
        ['bostonglobe.com', 80],
        ['theguardian.com', 78],
        ['mjbizdaily.com', 76],
        ['marijuanamoment.net', 74],
        ['hempindustrydaily.com', 72],
        ['ganjapreneur.com', 70],
        ['norml.org', 88],
        ['medscape.com', 68],
        ['yahoo.com', 42],
        ['thedailybeast.com', 20],
    ];

    const STOP = new Set([
        'the', 'a', 'an', 'and', 'or', 'of', 'for', 'in', 'on', 'to', 'with', 'after',
        'from', 'its', 'as', 'at', 'by', 'is', 'are', 'has', 'have', 'was', 'were',
        'new', 'says', 'said', 'news', 'what', 'know', 'over', 'into', 'than',
    ]);

    function hostOf(url) {
        try {
            return new URL(url).hostname.replace(/^www\./, '').toLowerCase();
        } catch (e) {
            return '';
        }
    }

    function isLegalHost(host) {
        return LEGAL_HOSTS.some((h) => host === h || host.endsWith('.' + h));
    }

    function isCannabisServiceHost(hostOrUrl) {
        const host = hostOrUrl.includes('://') ? hostOf(hostOrUrl) : String(hostOrUrl || '').replace(/^www\./, '').toLowerCase();
        if (!host || isLegalHost(host)) return false;
        return SERVICE_HOSTS.some((h) => host === h || host.endsWith('.' + h));
    }

    function hostRank(url) {
        const host = hostOf(url);
        if (isCannabisServiceHost(host)) return 0;
        let best = 50;
        HOST_RANK.forEach(([h, score]) => {
            if (host === h || host.endsWith('.' + h)) best = Math.max(best, score);
        });
        const path = String(url || '').toLowerCase();
        if (/\/press-release\//.test(path) || /newmediawire/.test(path)) best -= 25;
        if (/\.yahoo\.com/.test(host) || host === 'yahoo.com') best = Math.min(best, 42);
        return best;
    }

    function titleTokens(title) {
        return String(title || '')
            .toLowerCase()
            .replace(/['’]/g, '')
            .split(/[^a-z0-9]+/)
            .map((w) => (w.length > 5 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w))
            .filter((w) => w.length >= 4 && !STOP.has(w));
    }

    function titlesAreSameStory(a, b) {
        const A = new Set(titleTokens(a));
        const B = new Set(titleTokens(b));
        if (A.size < 3 || B.size < 3) return false;
        let inter = 0;
        A.forEach((w) => { if (B.has(w)) inter += 1; });
        const overlap = inter / Math.min(A.size, B.size);
        if (inter >= 5) return true;
        if (inter >= 4 && overlap >= 0.55) return true;
        if (inter >= 3 && overlap >= 0.72) return true;
        return false;
    }

    function pickPrimary(group) {
        return [...group].sort((a, b) => {
            const rd = hostRank(b.url) - hostRank(a.url);
            if (rd) return rd;
            const ld = String(b.description || '').length - String(a.description || '').length;
            if (ld) return ld;
            return String(b.title || '').length - String(a.title || '').length;
        })[0];
    }

    function toAlt(article) {
        return {
            title: article.title || '',
            url: article.url || '',
            date: article.date || '',
            host: hostOf(article.url),
            description: article.description || '',
        };
    }

    function explodeGrouped(articles) {
        const out = [];
        const seen = new Set();
        (Array.isArray(articles) ? articles : []).forEach((article) => {
            if (!article || !article.url) return;
            const pushRow = (row) => {
                const key = String(row.url || '').replace(/^https?:\/\//, '').replace(/\/+$/, '').toLowerCase();
                if (!key || seen.has(key) || isCannabisServiceHost(row.url)) return;
                seen.add(key);
                const copy = { ...row };
                delete copy.groupedSources;
                delete copy.groupedExpanded;
                out.push(copy);
            };
            pushRow(article);
            (article.groupedSources || []).forEach((g) => {
                if (!g || !g.url) return;
                pushRow({
                    title: g.title || article.title || '',
                    url: g.url,
                    date: g.date || '',
                    description: g.description || '',
                    sourceLabel: g.host || g.sourceLabel || '',
                });
            });
        });
        return out;
    }

    function collapseStoryGroups(articles) {
        const usable = explodeGrouped(articles);
        const parent = usable.map((_, i) => i);
        function find(i) {
            while (parent[i] !== i) {
                parent[i] = parent[parent[i]];
                i = parent[i];
            }
            return i;
        }
        function union(i, j) {
            const a = find(i);
            const b = find(j);
            if (a !== b) parent[b] = a;
        }
        for (let i = 0; i < usable.length; i++) {
            for (let j = i + 1; j < usable.length; j++) {
                if (titlesAreSameStory(usable[i].title, usable[j].title)) union(i, j);
            }
        }
        const buckets = new Map();
        usable.forEach((article, i) => {
            const root = find(i);
            if (!buckets.has(root)) buckets.set(root, []);
            buckets.get(root).push(article);
        });
        const out = [];
        buckets.forEach((group) => {
            const primary = pickPrimary(group);
            const alts = group.filter((a) => a.url !== primary.url).map(toAlt);
            const notes = group.map((a) => String(a.notes || '').trim()).filter(Boolean);
            const uniqueNotes = [...new Set(notes)];
            out.push({
                ...primary,
                notes: uniqueNotes.join(' | ') || primary.notes || '',
                groupedSources: alts,
                groupedExpanded: false,
            });
        });
        return out;
    }

    return {
        SERVICE_HOSTS,
        hostOf,
        hostRank,
        isCannabisServiceHost,
        titlesAreSameStory,
        pickPrimary,
        collapseStoryGroups,
    };
}));
