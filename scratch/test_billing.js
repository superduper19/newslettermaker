require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

async function testBilling() {
    const keys = {
        'Local Env Key': process.env.GEMINI_API_KEY,
        'Vercel Key': 'AIzaSyB4xvJy6E5fvL9ETGYo3hYRRrrbTpt3ye0'
    };

    for (const [name, key] of Object.entries(keys)) {
        if (!key) continue;
        console.log(`\nTesting ${name}...`);
        try {
            const genAI = new GoogleGenerativeAI(key);
            const model = genAI.getGenerativeModel({ model: 'gemini-3.1-pro-preview' });
            
            // Send a slightly larger request to see if it triggers billing/quota
            const prompt = "Explain quantum computing in exactly 50 words.";
            console.log(`Sending request to gemini-3.1-pro-preview...`);
            const result = await model.generateContent(prompt);
            console.log("SUCCESS:", result.response.text().substring(0, 50) + "...");
        } catch (e) {
            console.error(`FAILED with ${name}:`, e.message);
        }
    }
}

testBilling();
