const express = require('express');
const router = express.Router();
const { matchStateIcons } = require('../lib/state-icons');
const {
    DEFAULT_PUBLIC_ROOT,
    getPublicBaseUrl,
    normalizePublicSubfolder,
    findReachablePublicUrl,
    getFtpRemoteDir,
    buildPublicImageUrl,
    applyEditionDatePrefix,
    getArticleSubfolder,
    getStatesSubfolder,
    getInspirationalSubfolder,
    isPublicUrlReachable,
    editionDatePrefix,
} = require('../lib/purablis-public-url');
const {
    getPurablisUrlCandidates,
    buildPurablisPublicUrl,
    buildArticleExportFilename,
    NEWS_ROUNDUP_BASE,
} = require('../lib/purablis-article-filename');
const multer = require('multer');
const path = require('path');
const sharp = require('sharp');
const fs = require('fs');
const os = require('os');

// Freepik API Configuration
const FREEPIK_ICONS_URL = 'https://api.magnific.com/v1/icons';
const API_KEY = process.env.FREEPIK_API_KEY;
const FREEPIK_SEARCH_TIMEOUT_MS = 15000;

// Multer disk storage for local image uploads (Windows-safe temp dir)
const uploadDir = path.join(os.tmpdir(), 'newsletter-uploads');
const diskStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const originalName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
        cb(null, `upload-${Date.now()}-${originalName}`);
    }
});
const uploadMiddleware = multer({ storage: diskStorage, limits: { fileSize: 10 * 1024 * 1024 } });
const memoryUploadMiddleware = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
const STATE_TABLE = process.env.SUPABASE_STATE_TABLE || 'newsletter_state';
const INSPIRATIONAL_LIBRARY_KEY = 'inspirational_library';
const STORAGE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'newsletter-images';
let supabase = null;

// FTP remote path from env (no leading slash). Public URL base with no trailing slash.
function getRemotePath(subfolder) {
    const folder = normalizePublicSubfolder(subfolder || process.env.GODADDY_PUBLIC_SUBFOLDER);
    const ftpPath = getFtpRemoteDir(folder, process.env.GODADDY_FTP_PATH || 'images');
    const publicRoot = getPublicBaseUrl().replace(/\/+$/, '');
    const publicUrlBase = folder
        ? `${publicRoot}/${folder.split('/').map(encodeURIComponent).join('/')}`
        : publicRoot;
    return { remoteDir: ftpPath, publicUrlBase, publicSubfolder: folder };
}

function getStateIconsRemotePath() {
    const subfolder = getStatesSubfolder();
    const publicRoot = getPublicBaseUrl().replace(/\/+$/, '');
    const publicBase = (
        process.env.GODADDY_STATE_PUBLIC_BASE_URL
        || `${publicRoot}/${subfolder.split('/').map(encodeURIComponent).join('/')}`
    ).replace(/\/+$/, '');
    return {
        remoteDir: getFtpRemoteDir(subfolder, process.env.GODADDY_FTP_PATH || 'images'),
        publicUrlBase: publicBase,
        publicSubfolder: subfolder,
    };
}

function getInspirationalRemotePath() {
    const subfolder = getInspirationalSubfolder();
    const publicRoot = getPublicBaseUrl().replace(/\/+$/, '');
    const publicBase = (
        process.env.GODADDY_INSPIRATIONAL_PUBLIC_BASE_URL
        || `${publicRoot}/${subfolder.split('/').map(encodeURIComponent).join('/')}`
    ).replace(/\/+$/, '');
    return {
        remoteDir: getFtpRemoteDir(subfolder, process.env.GODADDY_FTP_PATH || 'images'),
        publicUrlBase: publicBase,
        publicSubfolder: subfolder,
    };
}

function getRemotePathForTarget(target, subfolder) {
    if (target === 'inspirational') return getInspirationalRemotePath();
    if (target === 'state') return getStateIconsRemotePath();
    return getRemotePath(getArticleSubfolder());
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

/** Only user inspirational uploads — not article icons (freepik-, state-, upload-, etc.). */
function isInspirationalLibraryFilename(name) {
    const n = String(name || '').trim();
    if (!n || !isImageFile(n)) return false;
    const lower = n.toLowerCase();
    if (lower.startsWith('freepik-') || lower.startsWith('state-') || lower.startsWith('upload-')) {
        return false;
    }
    if (lower.startsWith('insp-')) return true;
    if (lower.includes('_insp_') || lower.includes('insp_')) return true;
    // Legacy inspirational assets from bookbunnylibrary (e.g. 2020-15-01__DR_Jerzy_Vetulani_FR.jpg)
    if (/^\d{4}-\d{2}-\d{2}__/.test(n)) return true;
    return false;
}

function filterInspirationalLibraryImages(images) {
    return normalizeLibraryImages(images)
        .filter((item) => isInspirationalLibraryFilename(item.name))
        .map((item) => {
            const name = item.name || extractFilenameFromUrl(item.url);
            const previewUrl = (item.url && /^https:\/\/[^/]*purablis\.com/i.test(item.url))
                ? item.url
                : (name ? `${getInspirationalRemotePath().publicUrlBase}/${encodeURIComponent(name)}` : item.url);
            return { ...item, previewUrl };
        });
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
                .filter((entry) => entry.isFile && isInspirationalLibraryFilename(entry.name))
                .map((entry) => ({
                    name: entry.name,
                    url: `${publicUrlBase}/${entry.name}`,
                    source: 'ftp',
                    modifiedAt: entry.modifiedAt,
                }))
                .sort((a, b) => b.modifiedAt ? (b.modifiedAt - a.modifiedAt) : a.name.localeCompare(b.name));
        } finally {
            client.close();
        }
    }

    if (!fs.existsSync(uploadDir)) {
        return [];
    }

    return fs.readdirSync(uploadDir)
        .filter(name => isImageFile(name))
        .map(name => {
            const fullPath = path.join(uploadDir, name);
            const stats = fs.statSync(fullPath);
            return {
                name,
                url: filePathToDataUrl(fullPath, getMimeTypeFromName(name)),
                source: 'inline',
                modifiedAt: stats.mtime,
            };
        })
        .sort((a, b) => b.modifiedAt ? (b.modifiedAt - a.modifiedAt) : a.name.localeCompare(b.name));
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

async function ftpCdToDir(client, remoteDir) {
    const parts = String(remoteDir || '').replace(/^\/+/, '').split('/').filter(Boolean);
    await client.cd('/');
    for (const part of parts) {
        try {
            await client.cd(part);
        } catch (e) {
            await client.send(`MKD ${part}`);
            await client.cd(part);
        }
    }
}

async function uploadLocalFileToPurablis(localPath, filename, target = 'article', subfolder = '') {
    let publishName = path.basename(filename || '');
    if (target === 'article') {
        publishName = applyEditionDatePrefix(publishName);
    }
    const { remoteDir, publicUrlBase } = getRemotePathForTarget(target, subfolder);
    if (!publicUrlBase) {
        throw new Error('GODADDY_PUBLIC_BASE_URL is not configured');
    }
    const client = await accessFtpClient();
    try {
        await ftpCdToDir(client, remoteDir);
        await client.uploadFrom(localPath, publishName);
        console.log(`FTP upload OK (${target}): ${remoteDir}/${publishName}`);
        return `${publicUrlBase}/${publishName}`;
    } finally {
        client.close();
    }
}

function resolveStateIconLocalPath(url) {
    const value = String(url || '').trim();
    const match = value.match(/\/(?:all\/states|state_icons_dark)\/([^?#]+)/i);
    if (!match) return null;
    const filename = decodeURIComponent(match[1]);
    const localPath = path.join(__dirname, '..', 'public', 'state_icons_dark', filename);
    if (!fs.existsSync(localPath)) return null;
    return { localPath, filename };
}

async function resolveUrlToLocalFile(url, target = 'article') {
    const value = String(url || '').trim();
    const stateLocal = resolveStateIconLocalPath(value);
    if (stateLocal) {
        return { localPath: stateLocal.localPath, filename: stateLocal.filename };
    }
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
    
    let outBuf = buf;
    if (target === 'inspirational') {
        try {
            const metadata = await sharp(buf).metadata();
            const isTransparentFormat = ext.includes('png') || ext.includes('gif') || ext.includes('webp') || ext.includes('svg');
            const hasAlpha = metadata.hasAlpha || isTransparentFormat;
            
            let sharpChain = sharp(buf)
                .resize(300, 300, { fit: 'inside', withoutEnlargement: true });
            
            if (hasAlpha) {
                sharpChain = sharpChain.png({ palette: false, compressionLevel: 9 });
            } else {
                sharpChain = sharpChain.flatten({ background: '#ffffff' }).jpeg({ quality: 80 });
            }
            outBuf = await sharpChain.toBuffer();
        } catch (err) {
            console.warn('Failed to resize inspirational image:', err.message);
        }
    }
    
    fs.writeFileSync(localPath, outBuf);
    return { localPath, filename };
}

function buildAssetPreviewUrl(filename) {
    const safe = encodeURIComponent(path.basename(filename || ''));
    return safe ? `/api/images/asset/${safe}` : '';
}

async function publishImageUrlToPurablis(url, target = 'article', options = {}) {
    const stateLocal = resolveStateIconLocalPath(url);
    const effectiveTarget = stateLocal ? 'state' : target;
    const subfolder = effectiveTarget === 'inspirational'
        ? getInspirationalSubfolder()
        : effectiveTarget === 'state'
            ? getStatesSubfolder()
            : getArticleSubfolder();
    const { localPath, filename } = await resolveUrlToLocalFile(url, effectiveTarget);
    const publicUrl = await uploadLocalFileToPurablis(localPath, filename, effectiveTarget, subfolder);
    const publishFilename = effectiveTarget === 'article'
        ? applyEditionDatePrefix(filename)
        : path.basename(filename || '');
    const { publicReachable, tried } = await findReachablePublicUrl(publishFilename, subfolder, {
        baseUrl: getPublicBaseUrl(),
    });
    const configuredUrl = buildPublicImageUrl(publishFilename, {
        subfolder,
        baseUrl: getPublicBaseUrl(),
    });
    const resolvedUrl = publicReachable ? publicUrl : (publicUrl || configuredUrl);
    return {
        success: true,
        url: resolvedUrl,
        configuredUrl,
        previewUrl: resolvedUrl,
        published: true,
        filename: publishFilename,
        provider: 'purablis',
        publicReachable,
        publicSubfolder: subfolder,
        tried,
        ftpRemoteDir: getFtpRemoteDir(subfolder, process.env.GODADDY_FTP_PATH || 'images'),
    };
}

function normalizeLibraryImages(images) {
    const seen = new Set();
    const list = (Array.isArray(images) ? images : [])
        .filter(item => item && item.url)
        .map(item => {
            const url = String(item.url).trim();
            const name = item.name || extractFilenameFromUrl(url);
            return {
                name,
                url,
                source: item.source || 'db',
                metadata: item.metadata || null,
                modifiedAt: item.modifiedAt || null
            };
        });

    // Extract all flaticon/freepik IDs and map them to their beautiful names and metadata
    const idToInfo = new Map();
    list.forEach(item => {
        const urlStr = item.url.toLowerCase();
        const idMatch = urlStr.match(/freepik-(\d+)\.png$/) || urlStr.match(/(\d+)\.png$/);
        const name = String(item.name || '');
        const hasDescriptiveName = name.includes('(') && name.includes(')');
        if (idMatch && (hasDescriptiveName || item.metadata)) {
            const id = idMatch[1];
            idToInfo.set(id, {
                name: item.name,
                metadata: item.metadata
            });
        }
    });

    // Apply the mapped descriptive names and metadata to any unnamed occurrences of the same icon ID
    const normalized = list.map(item => {
        const urlStr = item.url.toLowerCase();
        const idMatch = urlStr.match(/freepik-(\d+)\.png$/) || urlStr.match(/(\d+)\.png$/);
        if (idMatch) {
            const id = idMatch[1];
            if (idToInfo.has(id)) {
                const info = idToInfo.get(id);
                return {
                    ...item,
                    name: info.name,
                    metadata: info.metadata || item.metadata
                };
            }
        }
        return item;
    });

    // Unique-ify by url to prevent duplicates
    return normalized
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
    return data ? filterInspirationalLibraryImages(data.value) : null;
}

async function saveInspirationalLibraryToDb(images) {
    const client = getSupabase();
    if (!client) return false;

    const normalized = filterInspirationalLibraryImages(images);
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

// GET /api/images/inspirational-library - inspirational uploads only (insp-*, legacy INSP assets)
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
            images = filterInspirationalLibraryImages([...images, ...(fromFtp || [])]);
        } catch (ftpErr) {
            console.warn('Inspirational library FTP list failed:', ftpErr.message);
        }
        if (!images.length) {
            try {
                const legacy = await listSupabaseInspirationalLibrary();
                if (legacy && legacy.length) images = filterInspirationalLibraryImages(legacy);
            } catch (e) {
                console.warn('Legacy Supabase inspirational list failed:', e.message);
            }
        }
        images = filterInspirationalLibraryImages(images);
        try {
            await saveInspirationalLibraryToDb(images);
        } catch (dbErr) {
            console.warn('Inspirational library DB prune failed:', dbErr.message);
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

const PAST_ICONS_LIBRARY_KEY = 'past_icons_library';

function isArticleIconFilename(name) {
    const n = String(name || '').trim();
    if (!n || !isImageFile(n)) return false;
    const lower = n.toLowerCase();
    // Exclude inspirational images which usually start with insp- or have insp in the name.
    if (lower.startsWith('insp-') || lower.includes('_insp_') || lower.includes('insp_')) {
        return false;
    }
    return true;
}

async function listPastIconsFromFtp() {
    const ftp = getFtpConfig();

    if (ftp.host && ftp.user && ftp.password) {
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

            const { getFtpRemoteDir } = require('../lib/purablis-public-url');
            const baseDir = getFtpRemoteDir('');

            const entries = await client.list(baseDir);
            const allImages = [];

            for (const entry of entries) {
                if (entry.isDirectory && /^\d{2}-\d{2}-\d{2}$/.test(entry.name)) {
                    const subPathInfo = getRemotePath(entry.name);
                    try {
                        const subEntries = await client.list(subPathInfo.remoteDir);
                        const imgs = subEntries
                            .filter((e) => e.isFile && isArticleIconFilename(e.name))
                            .map((e) => ({
                                name: e.name,
                                url: `${subPathInfo.publicUrlBase}/${e.name}`,
                                source: 'ftp',
                            }));
                        allImages.push(...imgs);
                    } catch (subErr) {
                        console.warn(`Failed to list dir ${subPathInfo.remoteDir}:`, subErr.message);
                    }
                }
            }

            return allImages.sort((a, b) => b.name.localeCompare(a.name)); // Newest first
        } catch (err) {
            console.error('FTP list error:', err.message);
        } finally {
            client.close();
        }
    }
    return [];
}

async function getPastIconsLibraryFromDb() {
    const client = getSupabase();
    if (!client) return null;

    const { data, error } = await client
        .from(STATE_TABLE)
        .select('value')
        .eq('key', PAST_ICONS_LIBRARY_KEY)
        .maybeSingle();

    if (error) {
        throw new Error(error.message);
    }
    return data ? normalizeLibraryImages(data.value) : null;
}

async function savePastIconsLibraryToDb(images) {
    const client = getSupabase();
    if (!client) return false;

    const normalized = normalizeLibraryImages(images);
    const { error } = await client
        .from(STATE_TABLE)
        .upsert(
            { key: PAST_ICONS_LIBRARY_KEY, value: normalized, updated_at: new Date().toISOString() },
            { onConflict: 'key' },
        );

    if (error) {
        throw new Error(error.message);
    }
    return true;
}

// GET /api/images/past-icons - list previously uploaded article icons
router.get('/past-icons', async (req, res) => {
    try {
        let images = [];
        try {
            const fromDb = await getPastIconsLibraryFromDb();
            if (fromDb) images = fromDb;
        } catch (dbErr) {
            console.warn('Past icons DB read failed:', dbErr.message);
        }
        
        try {
            const fromFtp = await listPastIconsFromFtp();
            images = normalizeLibraryImages([...images, ...(fromFtp || [])]);
        } catch (ftpErr) {
            console.warn('Past icons FTP list failed:', ftpErr.message);
        }
        
        images = normalizeLibraryImages(images);
        
        try {
            await savePastIconsLibraryToDb(images);
        } catch (dbErr) {
            console.warn('Past icons DB save failed:', dbErr.message);
        }
        
        res.json({ success: true, images });
    } catch (error) {
        console.error('Past icons list error:', error);
        res.status(500).json({ error: 'Failed to load past icons' });
    }
});

/** Prefer "essence flat" queries; fall back to one keyword for legacy input. */
function buildIconSearchTerm(query) {
    const raw = String(query || '').trim().toLowerCase();
    if (!raw) return 'news flat';
    if (/\s+flat$/.test(raw)) return raw;
    const words = raw.split(/\s+/).filter((w) => w.length > 2);
    if (words.length === 0) return 'news flat';
    return `${words[0]} flat`;
}

async function fetchFreepikIcons(searchTerm, page) {
    if (!API_KEY) {
        return { error: 'FREEPIK_API_KEY is not configured on the server.', status: 503 };
    }
    const fetch = (await import('node-fetch')).default;
    const url = `${FREEPIK_ICONS_URL}?locale=en-US&page=${page}&limit=9&term=${encodeURIComponent(searchTerm)}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FREEPIK_SEARCH_TIMEOUT_MS);
    try {
        const response = await fetch(url, {
            headers: {
                'X-Magnific-API-Key': API_KEY,
                'Accept-Language': 'en-US',
            },
            signal: controller.signal,
        });
        clearTimeout(timer);
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Freepik/Flaticon API Error:', response.status, errorText);
            return { error: 'Image search failed', details: errorText, status: response.status };
        }
        const data = await response.json();
        const items = Array.isArray(data?.data) ? data.data : [];
        const images = items
            .map((item) => ({
                id: item.id,
                title: item.name || 'Icon',
                preview: item.thumbnails && item.thumbnails[0] ? item.thumbnails[0].url : '',
                download: item.thumbnails && item.thumbnails[0] ? item.thumbnails[0].url : '',
            }))
            .filter((img) => img.preview);
        return { images };
    } catch (error) {
        clearTimeout(timer);
        if (error.name === 'AbortError') {
            return { error: 'Freepik search timed out. Try a shorter keyword.', status: 504 };
        }
        throw error;
    }
}

router.post('/search', async (req, res) => {
    try {
        const { query, page = 1 } = req.body;

        if (!query) {
            return res.status(400).json({ error: 'Search query is required' });
        }

        const stateImages = matchStateIcons(query, 8);
        const searchTerm = buildIconSearchTerm(query);
        
        let result = { error: 'Skipped', images: [] };
        let usedFallback = false;
        let freepikError = null;

        // If we found a matching state icon, skip the Freepik API call to save credits
        if (stateImages && stateImages.length > 0) {
            console.log(`Found ${stateImages.length} state icon(s) for "${query}", skipping Flaticon/Freepik API call.`);
        } else {
            console.log(`Searching Flaticon (Freepik API) for: "${searchTerm}" (from "${query}", page ${page})`);
            result = await fetchFreepikIcons(searchTerm, page);
            
            if (result.error && result.status === 504 && searchTerm !== 'cannabis') {
                console.warn(`Freepik timed out for "${searchTerm}", retrying with "cannabis"`);
                const fallback = await fetchFreepikIcons('cannabis', page);
                if (!fallback.error && fallback.images.length > 0) {
                    result = fallback;
                    usedFallback = true;
                }
            }
            
            if (result.error) {
                console.warn(`Freepik search skipped: ${result.error}`, result.details || '');
                freepikError = result.error;
            }
        }

        const freepikImages = result.error ? [] : result.images.slice(0, 9);

        res.json({
            success: true,
            page,
            images: freepikImages,
            stateImages,
            searchTerm: usedFallback ? 'cannabis' : searchTerm,
            originalQuery: query,
            usedFallback,
            freepikSkipped: !!result.error,
            freepikError,
        });

    } catch (error) {
        console.error('Image Search Error:', error);
        res.status(500).json({ error: error.message || 'Image search failed' });
    }
});

// POST /api/images/upload - Upload a local image file (local only, no FTP)
router.post('/upload', uploadMiddleware.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }
        const localPath = req.file.path;
        try {
            const buffer = fs.readFileSync(localPath);
            const mimetype = String(req.file.mimetype || '').toLowerCase();
            const originalName = String(req.file.originalname || '').toLowerCase();
            const metadata = await sharp(buffer).metadata();
            const isTransparentFormat = mimetype.includes('png') || mimetype.includes('gif') || mimetype.includes('webp') || mimetype.includes('svg') || originalName.endsWith('.png') || originalName.endsWith('.gif') || originalName.endsWith('.webp') || originalName.endsWith('.svg');
            const hasAlpha = metadata.hasAlpha || isTransparentFormat;

            let sharpChain = sharp(buffer)
                .resize(100, 100, { fit: 'inside', withoutEnlargement: true })
                .withMetadata({ density: 72 });

            if (hasAlpha) {
                sharpChain = sharpChain.png({ palette: false, compressionLevel: 9 });
            } else {
                sharpChain = sharpChain.flatten({ background: '#ffffff' }).jpeg({ quality: 80 });
            }

            const resizedBuffer = await sharpChain.toBuffer();
            fs.writeFileSync(localPath, resizedBuffer);
        } catch (err) {
            console.warn('Failed to resize uploaded image:', err.message);
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

        try {
            const buffer = fs.readFileSync(localPath);
            const mimetype = String(req.file.mimetype || '').toLowerCase();
            const originalName = String(req.file.originalname || '').toLowerCase();
            const metadata = await sharp(buffer).metadata();
            const isTransparentFormat = mimetype.includes('png') || mimetype.includes('gif') || mimetype.includes('webp') || mimetype.includes('svg') || originalName.endsWith('.png') || originalName.endsWith('.gif') || originalName.endsWith('.webp') || originalName.endsWith('.svg');
            const hasAlpha = metadata.hasAlpha || isTransparentFormat;

            let sharpChain = sharp(buffer)
                .resize(100, 100, { fit: 'inside', withoutEnlargement: true })
                .withMetadata({ density: 72 });

            if (hasAlpha) {
                sharpChain = sharpChain.png({ palette: false, compressionLevel: 9 });
            } else {
                sharpChain = sharpChain.flatten({ background: '#ffffff' }).jpeg({ quality: 80 });
            }

            const resizedBuffer = await sharpChain.toBuffer();
            fs.writeFileSync(localPath, resizedBuffer);
        } catch (err) {
            console.warn('Failed to resize uploaded article image:', err.message);
        }

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
            const publishName = applyEditionDatePrefix(filename);
            const publicUrl = await uploadLocalFileToPurablis(localPath, publishName, 'article', getArticleSubfolder());
            res.json({ success: true, url: publicUrl, published: true, filename: publishName });
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
        let { url, target, publicSubfolder } = req.body || {};
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

        const metadata = await sharp(buffer).metadata();
        const mimetype = String(req.file.mimetype || '').toLowerCase();
        const isTransparentFormat = mimetype.includes('png') || mimetype.includes('gif') || mimetype.includes('webp') || mimetype.includes('svg') || originalName.toLowerCase().endsWith('.png') || originalName.toLowerCase().endsWith('.gif') || originalName.toLowerCase().endsWith('.webp') || originalName.toLowerCase().endsWith('.svg');
        const hasAlpha = metadata.hasAlpha || isTransparentFormat;

        let outBuffer = buffer;
        try {
            let sharpChain = sharp(buffer)
                .resize(300, 300, { fit: 'inside', withoutEnlargement: true });

            if (hasAlpha) {
                sharpChain = sharpChain.png({ palette: false, compressionLevel: 9 });
            } else {
                sharpChain = sharpChain.flatten({ background: '#ffffff' }).jpeg({ quality: 80 });
            }

            outBuffer = await sharpChain.toBuffer();
        } catch (err) {
            console.warn('Failed to resize uploaded inspirational image:', err.message);
        }

        if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
        const localPath = path.join(uploadDir, safeName);
        fs.writeFileSync(localPath, outBuffer);

        const publicUrl = await uploadLocalFileToPurablis(localPath, safeName, 'inspirational', getInspirationalSubfolder());
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

        res.json({
            success: true,
            url: publicUrl,
            previewUrl: publicUrl,
            published: true,
            provider: 'purablis',
            filename: safeName,
            publicReachable: await isPublicUrlReachable(publicUrl),
        });
    } catch (error) {
        console.error('Inspirational Upload Error:', error);
        res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
});

const STATE_PUBLIC_DIR = path.join(__dirname, '..', 'public', 'state_icons_dark');

function stateFtpFilenameToLocalPath(filename) {
    const match = String(filename || '').match(/^state-([a-z0-9-]+)\.png$/i);
    if (!match) return null;
    const name = match[1]
        .split('-')
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
    const localPath = path.join(STATE_PUBLIC_DIR, `${name}.png`);
    return fs.existsSync(localPath) ? localPath : null;
}

// POST /api/images/resolve-article-urls — find live purablis.com URLs (News-roundup flat)
router.post('/resolve-article-urls', async (req, res) => {
    try {
        const { articles, datePrefix, baseUrl } = req.body || {};
        const list = Array.isArray(articles) ? articles : [];
        const prefix = datePrefix || editionDatePrefix();
        const base = (baseUrl || NEWS_ROUNDUP_BASE).replace(/\/+$/, '');
        const results = [];

        for (const article of list) {
            const candidates = getPurablisUrlCandidates(article, { datePrefix: prefix, baseUrl: base });
            let resolved = '';
            let publicReachable = false;
            for (const url of candidates) {
                if (await isPublicUrlReachable(url)) {
                    resolved = url;
                    publicReachable = true;
                    break;
                }
            }
            if (!resolved && candidates.length) {
                resolved = candidates[0];
            }
            const filename = buildArticleExportFilename(article, prefix);
            results.push({
                id: article.id,
                title: article.title,
                url: resolved,
                purablisFilename: filename,
                publicReachable,
                candidates: candidates.slice(0, 6),
            });
        }

        const reachable = results.filter((r) => r.publicReachable).length;
        res.json({
            ok: true,
            checked: results.length,
            reachable,
            publicBase: base,
            datePrefix: prefix,
            results,
        });
    } catch (error) {
        console.error('resolve-article-urls error:', error);
        res.status(500).json({ error: error.message || 'Resolve failed' });
    }
});

// POST /api/images/verify-public — HEAD-check public purablis URLs for filenames
router.post('/verify-public', async (req, res) => {
    try {
        const { filenames, publicSubfolder, baseUrl } = req.body || {};
        const list = Array.isArray(filenames) ? filenames : [];
        const subfolder = normalizePublicSubfolder(
            publicSubfolder !== undefined && publicSubfolder !== null
                ? publicSubfolder
                : getArticleSubfolder(),
        );
        const results = [];
        for (const name of list) {
            const filename = applyEditionDatePrefix(path.basename(String(name || '')));
            if (!filename) continue;
            const { url, publicReachable } = await findReachablePublicUrl(filename, subfolder, {
                baseUrl: baseUrl || getPublicBaseUrl(),
            });
            results.push({ filename, url, publicReachable });
        }
        const ok = results.filter((r) => r.publicReachable).length;
        res.json({
            ok: true,
            checked: results.length,
            reachable: ok,
            unreachable: results.length - ok,
            publicSubfolder: subfolder,
            publicBase: (baseUrl || getPublicBaseUrl()).replace(/\/+$/, ''),
            results,
        });
    } catch (error) {
        console.error('verify-public error:', error);
        res.status(500).json({ error: error.message || 'Verification failed' });
    }
});

// GET /api/images/asset/:filename — serve FTP-uploaded images (FTP folder is not always public HTTP)
router.get('/asset/:filename', async (req, res) => {
    try {
        const filename = path.basename(req.params.filename || '');
        if (!filename || !isImageFile(filename)) {
            return res.status(400).json({ error: 'Invalid filename' });
        }

        const stateLocal = stateFtpFilenameToLocalPath(filename);
        if (stateLocal) {
            return res.sendFile(stateLocal);
        }

        const { remoteDir } = getRemotePath();
        const client = await accessFtpClient();
        const tempPath = path.join(uploadDir, `asset-${Date.now()}-${filename}`);
        const remoteFile = path.posix.join(String(remoteDir || 'images').replace(/^\/+/, ''), filename);
        try {
            await client.downloadTo(tempPath, remoteFile);
        } finally {
            client.close();
        }
        res.sendFile(tempPath, () => {
            try {
                if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
            } catch (e) {
                // ignore cleanup errors
            }
        });
    } catch (error) {
        console.error('Asset serve error:', error);
        res.status(404).json({ error: 'Image not found on server or FTP' });
    }
});

module.exports = router;
