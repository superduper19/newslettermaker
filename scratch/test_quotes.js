require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

async function testKeys() {
    const vercelKey = '"AIzaSyB4xvJy6E5fvL9ETGYo3hYRRrrbTpt3ye0"'; // Added quotes
    
    console.log("Testing Vercel Key with quotes...");
    try {
        const genAI1 = new GoogleGenerativeAI(vercelKey);
        const model1 = genAI1.getGenerativeModel({ model: 'gemini-3.1-pro-preview' });
        await model1.generateContent("Hello");
        console.log("Vercel key SUCCESS");
    } catch (e) {
        console.log("Vercel key FAILED:", e.message);
    }
}

testKeys();
