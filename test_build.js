const DEFAULT_PUBLIC_IMAGE_BASE = 'https://purablis.com/purablis.com/newsletter';
const newsletterContent = {};

function extractDateSubfolderFromUrl(url) {
    const match = String(url || '').match(/\/(\d{2}-\d{2}-\d{2})\//);
    return match ? match[1] : '';
}

function buildPurablisPublicUrlFromFilename(filename, originalUrl = '') {
    const fn = String(filename || '').trim().split('/').pop();
    if (!fn) return '';
    const base = (newsletterContent.publicImageBase || DEFAULT_PUBLIC_IMAGE_BASE).replace(/\/+$/, '');
    const dateFolder = extractDateSubfolderFromUrl(originalUrl);
    const pathSegment = dateFolder ? `${dateFolder}/` : '';
    return `${base}/${pathSegment}${encodeURIComponent(fn)}`;
}

console.log(buildPurablisPublicUrlFromFilename('06-01-26-freepik-10368712.png', 'https://purablis.com/purablis.com/newsletter/06-01-26/06-01-26-freepik-10368712.png'));
