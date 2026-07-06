async function countArticles() {
    const fetch = (await import('node-fetch')).default;
    try {
        const response = await fetch('http://localhost:3000/api/state?key=sessions');
        const data = await response.json();
        const sessions = data.value || {};
        
        for (const [sessionName, sessionData] of Object.entries(sessions)) {
            const articles = sessionData.articles || [];
            
            const counts = { MED: 0, THC: 0, CBD: 0, INV: 0 };
            const strictCounts = { MED: 0, THC: 0, CBD: 0, INV: 0 };
            
            for (const a of articles) {
                const status = (a.status || '').toUpperCase();
                const isEligible = ['Y', 'YM', 'M'].includes(status);
                const isStrictEligible = ['Y', 'YM'].includes(status);
                
                for (const cat of ['MED', 'THC', 'CBD', 'INV']) {
                    const ranks = a.ranks || {};
                    const rank = String(ranks[cat] || '').trim().toUpperCase();
                    if (rank && (/^\d+$/.test(rank) || rank === 'Y' || rank === 'YM')) {
                        if (isEligible) counts[cat]++;
                        if (isStrictEligible) strictCounts[cat]++;
                    }
                }
            }
        }
        
        // Also fetch workspace
        const wsRes = await fetch('http://localhost:3000/api/state?key=workspace');
        const wsData = await wsRes.json();
        const wsArticles = wsData.value ? (wsData.value.articles || []) : [];
        
        const counts = { MED: 0, THC: 0, CBD: 0, INV: 0 };
        const strictCounts = { MED: 0, THC: 0, CBD: 0, INV: 0 };
        for (const a of wsArticles) {
            const status = (a.status || '').toUpperCase();
            const isEligible = ['Y', 'YM', 'M'].includes(status);
            const isStrictEligible = ['Y', 'YM'].includes(status);
            
            for (const cat of ['MED', 'THC', 'CBD', 'INV']) {
                const ranks = a.ranks || {};
                const rank = String(ranks[cat] || '').trim().toUpperCase();
                if (rank && (/^\d+$/.test(rank) || rank === 'Y' || rank === 'YM')) {
                    if (isEligible) counts[cat]++;
                    if (isStrictEligible) strictCounts[cat]++;
                }
            }
        }
        console.log(`Workspace (Current Unsaved):`);
        console.log(`Current Code Counts (with 'M' status allowed): MED:${counts.MED} THC:${counts.THC} CBD:${counts.CBD} INV:${counts.INV}`);
        console.log(`Strict Counts (only 'Y', 'YM' status allowed): MED:${strictCounts.MED} THC:${strictCounts.THC} CBD:${strictCounts.CBD} INV:${strictCounts.INV}`);
        console.log('---');

    } catch (e) {
        console.error("Error:", e);
    }
}
countArticles();
