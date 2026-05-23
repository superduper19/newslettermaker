const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Freepik API Configuration
const FREEPIK_ICONS_URL = 'https://api.freepik.com/v1/icons';
const API_KEY = process.env.FREEPIK_API_KEY;

// Multer disk storage for local image uploads
const uploadDir = '/tmp/uploads';
const diskStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        // Sanitize filename to be safe but preserve original name
        const originalName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
        cb(null, originalName);
    }
});
const uploadMiddleware = multer({ storage: diskStorage, limits: { fileSize: 10 * 1024 * 1024 } });
const memoryUploadMiddleware = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
const STATE_TABLE = process.env.SUPABASE_STATE_TABLE || 'newsletter_state';
const INSPIRATIONAL_LIBRARY_KEY = 'inspirational_library';
const STORAGE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'newsletter-images';
let supabase = null;

// FTP remote path from env (no leading slash). Public URL base with no trailing slash.
function getRemotePath() {
    const ftpPath = (process.env.GODADDY_FTP_PATH || 'images').replace(/^\/+/, '');
    const publicBase = (process.env.GODADDY_PUBLIC_BASE_URL || '').replace(/\/+$/, '');
    return { remoteDir: ftpPath, publicUrlBase: publicBase };
}

function getInspirationalRemotePath() {
    const article = getRemotePath();
    // Default: same folder as article icons (News-roundup/images/) with insp- filenames.
    // Override with GODADDY_INSPIRATIONAL_* when a dedicated inspirational/ folder exists in cPanel.
    const ftpPath = (process.env.GODADDY_INSPIRATIONAL_FTP_PATH || article.remoteDir || 'images').replace(/^\/+/, '');
    const publicBase = (
        process.env.GODADDY_INSPIRATIONAL_PUBLIC_BASE_URL
        || article.publicUrlBase
        || 'https://purablis.com/News-roundup/images'
    ).replace(/\/+$/, '');
    return { remoteDir: ftpPath, publicUrlBase: publicBase };
}

function getRemotePathForTarget(target) {
    return target === 'inspirational' ? getInspirationalRemotePath() : getRemotePath();
}

function getFtpConfig() {
    return {
        host: process.env.GODADDY_FTP_HOST,
        user: process.env.GODADDY_FTP_USER,
        password: process.env.GODADDY_FTP_PASS,
        port: parseInt(process.env.GODADDY_FTP_PORT || '21')
    };
}

function getSupabase() {
    if (supabase) return supabase;
    try {
        const { createClient } = require('@supabase/supabase-js');
        const url = process.env.SUPABASE_URL;
        const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;
        if (url && key) {
            supabase = createClient(url, key);
            return supabase;
        }
    } catch (e) {
        console.warn('Supabase not configured for images:', e.message);
    }
    return null;
}

function isImageFile(name) {
    return /\.(png|jpe?g|gif|webp|svg)$/i.test(name || '');
}

function extractFilenameFromUrl(url) {
    try {
        const pathname = new URL(url).pathname;
        return path.basename(decodeURIComponent(pathname));
    } catch (e) {
        return path.basename(String(url || ''));
    }
}

function getMimeTypeFromName(name, fallback = 'application/octet-stream') {
    const ext = path.extname(name || '').toLowerCase();
    if (ext === '.png') return 'image/png';
    if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
    if (ext === '.gif') return 'image/gif';
    if (ext === '.webp') return 'image/webp';
    if (ext === '.svg') return 'image/svg+xml';
    return fallback;
}

function filePathToDataUrl(filePath, mimeType) {
    const buffer = fs.readFileSync(filePath);
    return `data:${mimeType || getMimeTypeFromName(filePath)};base64,${buffer.toString('base64')}`;
}

function resolveUploadsPathFromUrl(url) {
    const value = String(url || '').trim();
    const match = value.match(/\/uploads\/([^?#]+)/);
    if (!match) return null;
    const filename = match[1];
    const filePath = path.join(uploadDir, filename);
    if (!fs.existsSync(filePath)) return null;
    return { filePath, filename };
}

async function listInspirationalLibraryFromFtp() {
    const ftp = getFtpConfig();
    const { remoteDir, publicUrlBase } = getInspirationalRemotePath();

    if (ftp.host && ftp.user && ftp.password && publicUrlBase) {
        const { Client } = require('basic-ftp');
        const client = new Client();
        client.ftp.verbose = false;
        try {
            await client.access({
                host: ftp.host,
                port: ftp.port,
                user: ftp.user,
                password: ftp.password,
                secure: true,
                secureOptions: { rejectUnauthorized: false },
            });

            const entries = await client.list(remoteDir);
            return entries
                .filter(entry => entry.isFile && isImageFile(entry.name))
                .map(entry => ({
                    name: entry.name,
                    url: `${publicUrlBase}/${entry.name}`,
                    source: 'ftp'
                }))
                .sort((a, b) => a.name.localeCompare(b.name));
        } finally {
            client.close();
        }
    }

    if (!fs.existsSync(uploadDir)) {
        return [];
    }

    return fs.readdirSync(uploadDir)
        .filter(name => isImageFile(name))
        .map(name => ({
            name,
            url: filePathToDataUrl(path.join(uploadDir, name), getMimeTypeFromName(name)),
            source: 'inline',
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
}

async function listInspirationalLibrary() {
    return listInspirationalLibraryFromFtp();
}

async function accessFtpClient() {
    const ftp = getFtpConfig();
    if (!ftp.host || !ftp.user || !ftp.password) {
        throw new Error('GoDaddy FTP not configured');
    }
    const { Client } = require('basic-ftp');
    const client = new Client();
    client.ftp.verbose = false;
    await client.access({
        host: ftp.host,
        port: ftp.port,
        user: ftp.user,
        password: ftp.password,
        secure: true,
        secureOptions: { rejectUnauthorized: false },
    });
    return client;
}

async function uploadLocalFileToPurablis(localPath, filename, target = 'article') {
    const { remoteDir, publicUrlBase } = getRemotePathForTarget(target);
    if (!publicUrlBase) {
        throw new Error('GODADDY_PUBLIC_BASE_URL is not configured');
    }
    const client = await accessFtpClient();
    try {
        await client.ensureDir(remoteDir);
        await client.uploadFrom(localPath, filename);
        console.log(`FTP upload OK (${target}): ${remoteDir}/${filename}`);
        return `${publicUrlBase}/${filename}`;
    } finally {
        client.close();
    }
}

async function resolveUrlToLocalFile(url, target = 'article') {
    const value = String(url || '').trim();
    const namePrefix = target === 'inspirational' ? 'insp-' : (value.includes('freepik') ? 'freepik-' : '');
    const uploadsMatch = value.match(/\/uploads\/([^?#]+)/);
    if (value.startsWith('/uploads/') || uploadsMatch) {
        const filename = uploadsMatch ? uploadsMatch[1] : value.replace('/uploads/', '');
        const localPath = path.join(uploadDir, filename);
        if (!fs.existsSync(localPath)) {
            throw new Error(`Local file not found: ${localPath}`);
        }
        return { localPath, filename };
    }
    if (!/^https?:\/\//i.test(value)) {
        throw new Error('Unsupported URL: must be /uploads/... or http(s)://');
    }
    const fetch = (await import('node-fetch')).default;
    const resp = await fetch(value, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; NewsletterMaker/1.0)' },
    });
    if (!resp.ok) throw new Error(`Failed to fetch image: ${resp.status}`);
    const buf = await resp.buffer();
    const urlObj = new URL(value);
    let pathname = urlObj.pathname;
    try {
        pathname = decodeURIComponent(pathname);
    } catch (e) {
        // ignore malformed URI
    }
    const ext = path.extname(pathname) || '.png';
    const base = path.basename(pathname, ext).replace(/[^a-zA-Z0-9.-]/g, '_');
    const filename = (base && base.length > 2)
        ? `${namePrefix}${base}${ext}`
        : `${namePrefix}publish-${Date.now()}${ext}`;
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    const localPath = path.join(uploadDir, filename);
    fs.writeFileSync(localPath, buf);
    return { localPath, filename };
}

async function publishImageUrlToPurablis(url, target = 'article') {
    const { localPath, filename } = await resolveUrlToLocalFile(url, target);
    const publicUrl = await uploadLocalFileToPurablis(localPath, filename, target);
    return { success: true, url: publicUrl, published: true, filename, provider: 'purablis' };
}

function normalizeLibraryImages(images) {
    const seen = new Set();
    return (Array.isArray(images) ? images : [])
        .filter(item => item && item.url)
        .map(item => ({
            name: item.name || extractFilenameFromUrl(item.url),
            url: String(item.url).trim(),
            source: item.source || 'db',
        }))
        .filter(item => {
            if (!item.url || seen.has(item.url)) return false;
            seen.add(item.url);
            return true;
        })
        .sort((a, b) => a.name.localeCompare(b.name));
}

async function getInspirationalLibraryFromDb() {
    const client = getSupabase();
    if (!client) return null;

    const { data, error } = await client
        .from(STATE_TABLE)
        .select('value')
        .eq('key', INSPIRATIONAL_LIBRARY_KEY)
        .maybeSingle();

    if (error) {
        throw new Error(error.message);
    }
    return data ? normalizeLibraryImages(data.value) : null;
}

async function saveInspirationalLibraryToDb(images) {
    const client = getSupabase();
    if (!client) return false;

    const normalized = normalizeLibraryImages(images);
    const { error } = await client
        .from(STATE_TABLE)
        .upsert(
            { key: INSPIRATIONAL_LIBRARY_KEY, value: normalized, updated_at: new Date().toISOString() },
            { onConflict: 'key' },
        );

    if (error) {
        throw new Error(error.message);
    }
    return true;
}

async function ensureStorageBucket() {
    const client = getSupabase();
    if (!client) throw new Error('Supabase not configured for storage');

    const { data: buckets, error: listError } = await client.storage.listBuckets();
    if (listError) throw new Error(listError.message);

    const exists = (buckets || []).some(bucket => bucket && bucket.name === STORAGE_BUCKET);
    if (exists) return client;

    const { error: createError } = await client.storage.createBucket(STORAGE_BUCKET, {
        public: true,
        fileSizeLimit: 10 * 1024 * 1024,
        allowedMimeTypes: ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml'],
    });
    if (createError && !/already exists/i.test(createError.message || '')) {
        throw new Error(createError.message);
    }
    return client;
}

async function uploadInspirationalBufferToSupabase(buffer, filename, contentType) {
    const client = await ensureStorageBucket();
    const safeName = String(filename || `insp-${Date.now()}.png`).replace(/[^a-zA-Z0-9._-]/g, '_');
    const objectPath = `inspirational/${Date.now()}-${safeName}`;

    const { error: uploadError } = await client.storage
        .from(STORAGE_BUCKET)
        .upload(objectPath, buffer, {
            contentType: contentType || getMimeTypeFromName(safeName),
            upsert: false,
        });

    if (uploadError) {
        throw new Error(uploadError.message);
    }

    const { data } = client.storage.from(STORAGE_BUCKET).getPublicUrl(objectPath);
    if (!data || !data.publicUrl) {
        throw new Error('Could not generate public Supabase URL');
    }

    return {
        publicUrl: data.publicUrl,
        objectPath,
        filename: safeName,
    };
}

async function listSupabaseInspirationalLibrary() {
    const client = getSupabase();
    if (!client) return null;

    await ensureStorageBucket();
    const { data, error } = await client.storage.from(STORAGE_BUCKET).list('inspirational', {
        limit: 200,
        sortBy: { column: 'name', order: 'asc' },
    });
    if (error) {
        throw new Error(error.message);
    }

    return (data || [])
        .filter(item => item && item.name)
        .map(item => {
            const objectPath = `inspirational/${item.name}`;
            const { data: publicData } = client.storage.from(STORAGE_BUCKET).getPublicUrl(objectPath);
            return {
                name: item.name,
                url: publicData && publicData.publicUrl ? publicData.publicUrl : '',
                source: 'supabase',
            };
        })
        .filter(item => item.url);
}

// GET /api/images/inspirational-library - list previously uploaded inspirational images
router.get('/inspirational-library', async (req, res) => {
    try {
        let images = [];
        try {
            const fromDb = await getInspirationalLibraryFromDb();
            if (fromDb) images = fromDb;
        } catch (dbErr) {
            console.warn('Inspirational library DB read failed:', dbErr.message);
        }
        try {
            const fromFtp = await listInspirationalLibraryFromFtp();
            images = normalizeLibraryImages([...images, ...(fromFtp || [])]);
        } catch (ftpErr) {
            console.warn('Inspirational library FTP list failed:', ftpErr.message);
        }
        if (!images.length) {
            try {
                const legacy = await listSupabaseInspirationalLibrary();
                if (legacy && legacy.length) images = legacy;
            } catch (e) {
                console.warn('Legacy Supabase inspirational list failed:', e.message);
            }
        }
        res.json({ success: true, images });
    } catch (error) {
        console.error('Inspirational library list error:', error);
        res.status(500).json({ error: 'Failed to load inspirational image library' });
    }
});

// DELETE /api/images/inspirational-library - remove a previously uploaded inspirational image
router.delete('/inspirational-library', async (req, res) => {
    try {
        const { url } = req.body || {};
        if (!url || typeof url !== 'string') {
            return res.status(400).json({ error: 'Missing url' });
        }

        const filename = extractFilenameFromUrl(url.trim());
        if (!filename) {
            return res.status(400).json({ error: 'Could not determine filename' });
        }

        const ftp = getFtpConfig();
        const paths = [getRemotePath(), getInspirationalRemotePath()];

        if (ftp.host && ftp.user && ftp.password) {
            for (const { remoteDir, publicUrlBase } of paths) {
                if (!publicUrlBase || !url.startsWith(`${publicUrlBase}/`)) continue;
                const client = await accessFtpClient();
                try {
                    await client.remove(`${remoteDir}/${filename}`);
                } finally {
                    client.close();
                }
                break;
            }
        }

        const localPath = path.join(uploadDir, filename);
        if (fs.existsSync(localPath)) {
            fs.unlinkSync(localPath);
        }

        try {
            const existing = await getInspirationalLibraryFromDb();
            if (existing !== null) {
                const next = existing.filter(item => item.url !== url);
                await saveInspirationalLibraryToDb(next);
            }
        } catch (dbErr) {
            console.warn('Failed to update inspirational library DB after delete:', dbErr.message);
        }

        res.json({ success: true, filename });
    } catch (error) {
        console.error('Inspirational library delete error:', error);
        res.status(500).json({ error: error.message || 'Failed to delete inspirational image' });
    }
});

router.post('/search', async (req, res) => {
    try {
        const { query, page = 1 } = req.body;

        if (!query) {
            return res.status(400).json({ error: 'Search query is required' });
        }

        console.log(`Searching Flaticon (Freepik API) for: "${query}" (Page ${page})`);

        // Dynamic import for fetch (ESM)
        const fetch = (await import('node-fetch')).default;

        // Searching for ICONS specifically (Flaticon)
        const url = `${FREEPIK_ICONS_URL}?locale=en-US&page=${page}&limit=9&term=${encodeURIComponent(query)}`;

        const response = await fetch(url, {
            headers: {
                'X-Freepik-API-Key': API_KEY,
                'Accept-Language': 'en-US',
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Freepik/Flaticon API Error:', response.status, errorText);
            return res.status(response.status).json({ error: 'Image search failed', details: errorText });
        }

        const data = await response.json();

        // Transform data (Icons structure)
        const images = data.data.map(item => ({
            id: item.id,
            title: item.name || 'Icon',
            // Icons have 'thumbnails' array. Usually index 0 is best for preview.
            preview: item.thumbnails && item.thumbnails[0] ? item.thumbnails[0].url : '',
            download: item.thumbnails && item.thumbnails[0] ? item.thumbnails[0].url : '',
        }));

        res.json({
            success: true,
            page,
            images,
        });

    } catch (error) {
        console.error('Image Search Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// POST /api/images/upload - Upload a local image file (local only, no FTP)
router.post('/upload', uploadMiddleware.single('image'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }
        const url = `/uploads/${req.file.filename}`;
        console.log(`Image uploaded: ${req.file.filename}`);
        res.json({ success: true, url });
    } catch (error) {
        console.error('Image Upload Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// POST /api/images/inline-local - convert local /uploads/... URLs into data URLs for DB sharing
router.post('/inline-local', (req, res) => {
    try {
        const urls = Array.isArray(req.body && req.body.urls) ? req.body.urls : [];
        const results = {};
        urls.forEach((url) => {
            const resolved = resolveUploadsPathFromUrl(url);
            if (!resolved) return;
            results[String(url)] = filePathToDataUrl(resolved.filePath, getMimeTypeFromName(resolved.filename));
        });
        res.json({ success: true, results });
    } catch (error) {
        console.error('Inline local image error:', error);
        res.status(500).json({ error: error.message || 'Failed to inline local images' });
    }
});

// POST /api/images/upload-article - Upload article image, publish to GoDaddy FTP (purablis.com)
router.post('/upload-article', uploadMiddleware.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }
        const localPath = req.file.path;
        const filename = req.file.filename;
        const localUrl = `/uploads/${filename}`;
        const inlineUrl = filePathToDataUrl(localPath, req.file.mimetype || getMimeTypeFromName(filename));

        const ftpHost = process.env.GODADDY_FTP_HOST;
        const ftpUser = process.env.GODADDY_FTP_USER;
        const ftpPass = process.env.GODADDY_FTP_PASS;
        const ftpPort = parseInt(process.env.GODADDY_FTP_PORT || '21');

        if (!ftpHost || !ftpUser || !ftpPass) {
            console.warn('GoDaddy FTP not configured — returning inline image data');
            return res.json({ success: true, url: inlineUrl, fallbackUrl: localUrl, published: false, storedInline: true });
        }

        try {
            const publicUrl = await uploadLocalFileToPurablis(localPath, filename, 'article');
            res.json({ success: true, url: publicUrl, published: true });
        } catch (ftpErr) {
            console.error('FTP upload failed:', ftpErr.message);
            res.json({ success: true, url: inlineUrl, fallbackUrl: localUrl, published: false, ftpError: ftpErr.message, storedInline: true });
        }
    } catch (error) {
        console.error('Article Image Upload Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// POST /api/images/publish-to-purablis - Publish an image URL to GoDaddy FTP (Freepik, uploads, etc.)
// Body: { url, target?: 'article' | 'inspirational' }
router.post('/publish-to-purablis', async (req, res) => {
    try {
        let { url, target } = req.body || {};
        if (!url || typeof url !== 'string') {
            return res.status(400).json({ error: 'Missing url' });
        }
        url = url.trim();
        const uploadTarget = target === 'inspirational' ? 'inspirational' : 'article';

        try {
            const result = await publishImageUrlToPurablis(url, uploadTarget);
            if (uploadTarget === 'inspirational') {
                try {
                    const existing = await getInspirationalLibraryFromDb();
                    const next = normalizeLibraryImages([
                        ...(existing || []),
                        { name: result.filename, url: result.url, source: 'purablis' },
                    ]);
                    await saveInspirationalLibraryToDb(next);
                } catch (dbErr) {
                    console.warn('Failed to save inspirational publish in DB:', dbErr.message);
                }
            }
            res.json(result);
        } catch (ftpErr) {
            console.error('FTP publish failed:', ftpErr.message);
            res.json({ success: false, error: ftpErr.message });
        }
    } catch (error) {
        console.error('Publish to purablis error:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST /api/images/publish-inspirational-url - fetch external URL, upload to purablis.com via FTP
router.post('/publish-inspirational-url', async (req, res) => {
    try {
        let { url } = req.body || {};
        if (!url || typeof url !== 'string') {
            return res.status(400).json({ error: 'Missing url' });
        }
        url = url.trim();
        if (!/^https?:\/\//i.test(url)) {
            return res.status(400).json({ error: 'URL must start with http:// or https://' });
        }

        const result = await publishImageUrlToPurablis(url, 'inspirational');
        try {
            const existing = await getInspirationalLibraryFromDb();
            const next = normalizeLibraryImages([
                ...(existing || []),
                { name: result.filename, url: result.url, source: 'purablis' },
            ]);
            await saveInspirationalLibraryToDb(next);
        } catch (dbErr) {
            console.warn('Failed to save inspirational URL publish in DB:', dbErr.message);
        }

        res.json({ ...result, provider: 'purablis' });
    } catch (error) {
        console.error('Publish inspirational URL error:', error);
        res.status(500).json({ error: error.message || 'Failed to publish inspirational image URL' });
    }
});

// POST /api/images/upload-inspirational - Upload image to purablis.com via FTP
router.post('/upload-inspirational', memoryUploadMiddleware.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const originalName = String(req.file.originalname || `insp-${Date.now()}.png`);
        const safeName = `insp-${originalName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
        const buffer = req.file.buffer;
        if (!buffer || !buffer.length) {
            return res.status(400).json({ error: 'Uploaded file buffer was empty' });
        }

        if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
        const localPath = path.join(uploadDir, safeName);
        fs.writeFileSync(localPath, buffer);

        const publicUrl = await uploadLocalFileToPurablis(localPath, safeName, 'inspirational');
        try {
            const existing = await getInspirationalLibraryFromDb();
            const next = normalizeLibraryImages([
                ...(existing || []),
                { name: safeName, url: publicUrl, source: 'purablis' },
            ]);
            await saveInspirationalLibraryToDb(next);
        } catch (dbErr) {
            console.warn('Failed to save inspirational upload in DB:', dbErr.message);
        }

        res.json({ success: true, url: publicUrl, published: true, provider: 'purablis', filename: safeName });
    } catch (error) {
        console.error('Inspirational Upload Error:', error);
        res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
});

module.exports = router;
