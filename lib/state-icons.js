const path = require('path');
const fs = require('fs');

const STATE_ABBREVS = {
    Alabama: 'AL',
    Alaska: 'AK',
    Arizona: 'AZ',
    Arkansas: 'AR',
    California: 'CA',
    Colorado: 'CO',
    Connecticut: 'CT',
    Delaware: 'DE',
    Florida: 'FL',
    Georgia: 'GA',
    Hawaii: 'HI',
    Idaho: 'ID',
    Illinois: 'IL',
    Indiana: 'IN',
    Iowa: 'IA',
    Kansas: 'KS',
    Kentucky: 'KY',
    Louisiana: 'LA',
    Maine: 'ME',
    Maryland: 'MD',
    Massachusetts: 'MA',
    Michigan: 'MI',
    Minnesota: 'MN',
    Mississippi: 'MS',
    Missouri: 'MO',
    Montana: 'MT',
    Nebraska: 'NE',
    Nevada: 'NV',
    'New Hampshire': 'NH',
    'New Jersey': 'NJ',
    'New Mexico': 'NM',
    'New York': 'NY',
    'North Carolina': 'NC',
    'North Dakota': 'ND',
    Ohio: 'OH',
    Oklahoma: 'OK',
    Oregon: 'OR',
    Pennsylvania: 'PA',
    'Rhode Island': 'RI',
    'South Carolina': 'SC',
    'South Dakota': 'SD',
    Tennessee: 'TN',
    Texas: 'TX',
    Utah: 'UT',
    Vermont: 'VT',
    Virginia: 'VA',
    Washington: 'WA',
    'West Virginia': 'WV',
    Wisconsin: 'WI',
    Wyoming: 'WY',
};

const MANIFEST_PATH = path.join(__dirname, '..', 'data', 'state-icons-manifest.json');

function encodePublicUrl(baseUrl, filename) {
    const base = String(baseUrl || '').replace(/\/+$/, '');
    const segment = String(filename || '')
        .split('/')
        .map((part) => encodeURIComponent(part))
        .join('/');
    return `${base}/${segment}`;
}

function slugify(name) {
    return String(name || '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

function buildManifestEntry(name, filename, publicBase) {
    const abbrev = STATE_ABBREVS[name] || '';
    return {
        name,
        abbrev,
        slug: slugify(name),
        filename,
        url: encodePublicUrl(publicBase, filename),
        aliases: [
            name.toLowerCase(),
            slugify(name),
            abbrev.toLowerCase(),
        ].filter(Boolean),
    };
}

function buildManifestFromFilenames(filenames, publicBase) {
    const states = filenames
        .filter((f) => /\.png$/i.test(f))
        .map((filename) => {
            const name = path.basename(filename, path.extname(filename));
            return buildManifestEntry(name, filename, publicBase);
        })
        .sort((a, b) => a.name.localeCompare(b.name));
    return {
        baseUrl: String(publicBase || '').replace(/\/+$/, ''),
        states,
        updatedAt: new Date().toISOString(),
    };
}

let cachedManifest = null;

function loadStateIconsManifest() {
    if (cachedManifest) return cachedManifest;
    try {
        if (!fs.existsSync(MANIFEST_PATH)) {
            cachedManifest = { baseUrl: '', states: [] };
            return cachedManifest;
        }
        const raw = fs.readFileSync(MANIFEST_PATH, 'utf8');
        cachedManifest = JSON.parse(raw);
        return cachedManifest;
    } catch (e) {
        console.warn('Failed to load state icons manifest:', e.message);
        cachedManifest = { baseUrl: '', states: [] };
        return cachedManifest;
    }
}

function reloadStateIconsManifest() {
    cachedManifest = null;
    return loadStateIconsManifest();
}

function normalizeStateSearchQuery(query) {
    return String(query || '')
        .trim()
        .toLowerCase()
        .replace(/\s+flat$/i, '')
        .replace(/[^a-z0-9\s-]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function matchStateIcons(query, limit = 6) {
    const manifest = loadStateIconsManifest();
    const states = Array.isArray(manifest.states) ? manifest.states : [];
    if (!states.length) return [];

    const normalized = normalizeStateSearchQuery(query);
    if (!normalized || normalized.length < 2) return [];

    const scored = [];

    states.forEach((state) => {
        const name = String(state.name || '').toLowerCase();
        const abbrev = String(state.abbrev || '').toLowerCase();
        const slug = String(state.slug || '').toLowerCase();
        const aliases = Array.isArray(state.aliases) ? state.aliases.map((a) => String(a).toLowerCase()) : [];

        let score = 0;
        if (normalized === name || normalized === abbrev || normalized === slug) {
            score = 100;
        } else if (aliases.includes(normalized)) {
            score = 95;
        } else if (abbrev === normalized) {
            score = 90;
        } else if (name.startsWith(normalized) && normalized.length >= 3) {
            score = 80;
        } else if (normalized.split(' ').length >= 2 && name === normalized) {
            score = 85;
        } else {
            const queryWords = normalized.split(' ').filter((w) => w.length >= 2);
            const nameWords = name.split(' ');
            if (queryWords.length && queryWords.every((qw) => nameWords.some((nw) => nw.startsWith(qw) || nw === qw))) {
                score = 70;
            }
        }

        if (score > 0) {
            scored.push({
                id: `state-${slug || name}`,
                title: state.name,
                preview: state.url,
                download: state.url,
                source: 'state',
                score,
            });
        }
    });

    scored.sort((a, b) => b.score - a.score);
    const strong = scored.filter((s) => s.score >= 85);
    const list = strong.length ? strong : scored;
    return list.slice(0, limit);
}

module.exports = {
    STATE_ABBREVS,
    MANIFEST_PATH,
    encodePublicUrl,
    buildManifestFromFilenames,
    buildManifestEntry,
    loadStateIconsManifest,
    reloadStateIconsManifest,
    normalizeStateSearchQuery,
    matchStateIcons,
};
