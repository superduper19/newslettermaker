const fs = require('fs');
const path = require('path');
const https = require('https');

function slugify(text) {
    if (!text) return 'icon';
    return text.toString().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').substring(0, 50);
}

function downloadImage(url, dest) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(dest);
        https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (response) => {
            if (response.statusCode === 301 || response.statusCode === 302) {
                return downloadImage(response.headers.location, dest).then(resolve).catch(reject);
            }
            if (response.statusCode !== 200) {
                return reject(new Error('Failed to get image: ' + response.statusCode));
            }
            response.pipe(file);
            file.on('finish', () => {
                file.close(resolve);
            });
        }).on('error', (err) => {
            fs.unlink(dest, () => {});
            reject(err);
        });
    });
}

async function migrate() {
    console.log('Fetching sessions from local API...');
    const res = await fetch('http://localhost:5020/api/state?key=sessions');
    if (!res.ok) {
        console.error('Failed to fetch sessions');
        return;
    }
    const data = await res.json();
    const sessions = data.value || {};
    
    let updatedCount = 0;
    
    for (const sessionKey of Object.keys(sessions)) {
        const session = sessions[sessionKey];
        if (!session.articles) continue;
        
        let sessionNeedsUpdate = false;

        for (let i = 0; i < session.articles.length; i++) {
            const article = session.articles[i];
            
            const urlsToCheck = ['originalImageUrl', 'publishedImageUrl', 'image', 'uploadedImageUrl'];
            
            for (const field of urlsToCheck) {
                const url = article[field];
                if (url && typeof url === 'string' && (url.includes('freepik.com') || url.includes('flaticon.com'))) {
                    console.log(`\nFound Freepik URL in '${sessionKey}', article: '${article.title}'\n URL: ${url}`);
                    
                    try {
                        const safeName = slugify(article.title || 'icon') + '.png';
                        const uploadDir = path.join(__dirname, '..', 'uploads');
                        if (!fs.existsSync(uploadDir)) {
                            fs.mkdirSync(uploadDir, { recursive: true });
                        }
                        const localPath = path.join(uploadDir, safeName);
                        
                        await downloadImage(url, localPath);
                        
                        const localUploadUrl = 'http://localhost:5020/uploads/' + safeName;
                        
                        const pubRes = await fetch('http://localhost:5020/api/images/publish-to-purablis', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ url: localUploadUrl, target: 'article' })
                        });
                        const pubData = await pubRes.json();
                        
                        if (pubData.success && pubData.url) {
                            console.log(` -> Uploaded to GoDaddy: ${pubData.url}`);
                            article[field] = pubData.url;
                            sessionNeedsUpdate = true;
                        } else {
                            console.error(` -> Failed to upload:`, pubData.error || pubData);
                        }
                        
                        if (fs.existsSync(localPath)) {
                            fs.unlinkSync(localPath);
                        }
                    } catch (e) {
                        console.error(` -> Exception:`, e.message);
                    }
                }
            }
        }
        if (sessionNeedsUpdate) {
            updatedCount++;
        }
    }
    
    if (updatedCount > 0) {
        console.log(`\nFound ${updatedCount} sessions with migrated images. Saving updated sessions back to state...`);
        const saveRes = await fetch('http://localhost:5020/api/state', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key: 'sessions', value: sessions })
        });
        if (saveRes.ok) {
            console.log('Done! All Freepik images migrated to GoDaddy and state updated.');
        } else {
            console.error('Failed to save updated state.');
        }
    } else {
        console.log('\nNo Freepik URLs found to migrate.');
    }
}

migrate().catch(console.error);
