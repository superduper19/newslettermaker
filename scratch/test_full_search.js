async function testFullSearch() {
    console.log("Sending POST request to http://localhost:5020/api/articles/search...");
    
    const payload = {
        prompt: "find 5 articles about cannabis, marijuana cbd, hemp, opioids or psychedlics.",
        weekLabel: "Week 20",
        model: "gemini-3-1-pro" // This is the ID sent from the frontend dropdown
    };

    try {
        const response = await fetch("http://localhost:5020/api/articles/search", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
        }

        const data = await response.json();
        console.log("SUCCESS!");
        console.log(`Found ${data.articles ? data.articles.length : 0} articles.`);
        
        if (data.articles && data.articles.length > 0) {
            console.log("\nFirst article title:", data.articles[0].title);
            console.log("First article URL:", data.articles[0].url);
        } else {
            console.log("Response data:", data);
        }

    } catch (e) {
        console.error("SEARCH FAILED:", e.message);
    }
}

testFullSearch();
