const puppeteer = require('puppeteer');

(async () => {
    try {
        console.log('Launching browser...');
        const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
        const page = await browser.newPage();
        page.on('console', msg => console.log('BROWSER LOG:', msg.text()));
        page.on('pageerror', err => console.log('BROWSER ERROR:', err.message));
        
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
        
        await new Promise(r => setTimeout(r, 2000)); // wait for state to sync
        
        console.log('Opening confirmation tab...');
        await page.evaluate(() => {
            document.querySelector('#btn-next-step-6').click();
        });
        
        await new Promise(r => setTimeout(r, 3000)); // wait for render
        
        const tabsToTest = ['MED', 'THC', 'CBD', 'INV'];
        const fs = require('fs');

        for (const tabName of tabsToTest) {
            console.log(`Switching to ${tabName} sub-tab in confirmation...`);
            await page.evaluate((name) => {
                const tabs = Array.from(document.querySelectorAll('#step-6 button'));
                const tab = tabs.find(t => t.textContent.trim() === name);
                if (tab) tab.click();
            }, tabName);
            
            await new Promise(r => setTimeout(r, 3000)); // wait for iframe to update
            
            const iframeSrc = await page.evaluate(() => {
                const iframe = document.querySelector('#confirmation-preview-frame-wrap iframe');
                return iframe ? iframe.srcdoc : null;
            });
            
            if (iframeSrc) {
                fs.writeFileSync(`newsletter_preview_${tabName}.html`, iframeSrc);
                console.log(`Saved HTML to newsletter_preview_${tabName}.html`);
            } else {
                console.log(`Could not extract iframe srcdoc for ${tabName}`);
            }
        }

        await browser.close();
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
})();
