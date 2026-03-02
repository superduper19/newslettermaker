const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Freepik API Configuration
const FREEPIK_ICONS_URL = 'https://api.freepik.com/v1/icons';
const API_KEY = process.env.FREEPIK_API_KEY;

// Multer disk storage for local image uploads
const uploadDir = path.join(__dirname, '../public/uploads');
const diskStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, `upload-${Date.now()}${ext}`);
    }
});
const uploadMiddleware = multer({ storage: diskStorage, limits: { fileSize: 10 * 1024 * 1024 } });

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
                'Accept-Language': 'en-US'
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
            download: item.thumbnails && item.thumbnails[0] ? item.thumbnails[0].url : ''
        }));

        res.json({
            success: true,
            page,
            images
        });

    } catch (error) {
        console.error('Image Search Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// POST /api/images/upload - Upload a local image file
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

// POST /api/images/upload-inspirational - Upload image, publish to GoDaddy FTP, return public URL
router.post('/upload-inspirational', uploadMiddleware.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const localPath = req.file.path;
        const filename = req.file.filename;
        const localUrl = `/uploads/${filename}`;

        const ftpHost = process.env.GODADDY_FTP_HOST;
        const ftpUser = process.env.GODADDY_FTP_USER;
        const ftpPass = process.env.GODADDY_FTP_PASS;
        const ftpPort = parseInt(process.env.GODADDY_FTP_PORT || '21');
        const publicBase = process.env.GODADDY_PUBLIC_BASE_URL || '';

        if (!ftpHost || !ftpUser || !ftpPass) {
            console.warn('GoDaddy FTP not configured — returning local URL only');
            return res.json({ success: true, url: localUrl, published: false });
        }

        const { Client } = require('basic-ftp');
        const client = new Client();
        client.ftp.verbose = false;

        try {
            await client.access({
                host: ftpHost,
                port: ftpPort,
                user: ftpUser,
                password: ftpPass,
                secure: 'implicit',
                secureOptions: { rejectUnauthorized: false }
            });

            const remotePath = `/public_html/News-roundup/images/${filename}`;
            await client.ensureDir('/public_html/News-roundup/images/');
            await client.uploadFrom(localPath, remotePath);
            console.log(`FTP upload OK: ${remotePath}`);

            const publicUrl = publicBase
                ? `${publicBase}/images/${filename}`
                : localUrl;

            res.json({ success: true, url: publicUrl, published: true });
        } catch (ftpErr) {
            console.error('FTP upload failed:', ftpErr.message);
            res.json({ success: true, url: localUrl, published: false, ftpError: ftpErr.message });
        } finally {
            client.close();
        }

    } catch (error) {
        console.error('Inspirational Upload Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

module.exports = router;