const puppeteer = require('puppeteer');

(async () => {
    try {
        console.log('Launching browser...');
        const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
        const page = await browser.newPage();
        
        console.log('Navigating to app...');
        await page.goto('http://localhost:5020/', { waitUntil: 'networkidle0' });
        
        console.log('Waiting for sessions to load...');
        await page.waitForFunction('window.articles && window.articles.length > 0', { timeout: 10000 }).catch(e => console.log('Articles not loaded initially'));
        
        console.log('Switching to Week 17...');
        await page.evaluate(() => {
            const el = document.getElementById('saved-sessions-dropdown');
            if (el) {
                el.value = 'Week 17';
                el.dispatchEvent(new Event('change'));
            }
        });
        
        await page.waitForTimeout(2000); // wait for state to sync
        
        console.log('Opening confirmation tab...');
        await page.evaluate(() => {
            document.querySelector('.tab-btn[onclick="switchTab(\\\'confirmation\\\')"]').click();
        });
        
        await page.waitForTimeout(3000); // wait for ensureConfirmationPurablisUrls and render to finish
        
        console.log('Extracting iframe content...');
        const iframeSrc = await page.evaluate(() => {
            const iframe = document.querySelector('#confirmation-preview-frame-wrap iframe');
            return iframe ? iframe.srcdoc : 'No iframe found';
        });
        
        const urls = await page.evaluate(() => {
            const iframe = document.querySelector('#confirmation-preview-frame-wrap iframe');
            if (!iframe) return [];
            const doc = new DOMParser().parseFromString(iframe.srcdoc, 'text/html');
            return Array.from(doc.querySelectorAll('img.mcnImage, img')).map(img => img.src);
        });
        
        console.log('URLs found in confirmation preview iframe:');
        console.log(urls.join('\n'));
        
        await browser.close();
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
})();
