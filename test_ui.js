const puppeteer = require('puppeteer');

(async () => {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto('http://localhost:3000');

    // Enter prompt
    await page.type('#ai-prompt', 'find 4 articles about cannabis');
    
    // Click Search
    await page.click('#btn-search-articles');

    console.log('Waiting for search to complete...');
    // Wait for Next button to appear (which means search completed)
    await page.waitForSelector('#btn-next-step-2.inline-block', { timeout: 60000 });

    console.log('Search completed. Clicking Next...');
    await page.click('#btn-next-step-2');

    // Wait a bit for render
    await new Promise(r => setTimeout(r, 1000));

    // Check if articles exist
    const articleRows = await page.$$('.article-row');
    console.log(`Found ${articleRows.length} article rows after clicking Next.`);

    if (articleRows.length === 0) {
        const noArticles = await page.$eval('#articles-list', el => el.innerText);
        console.log('Articles List Text:', noArticles);
    }

    await browser.close();
})();
