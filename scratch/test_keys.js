require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

async function testKeys() {
    const vercelKey = 'AIzaSyB4xvJy6E5fvL9ETGYo3hYRRrrbTpt3ye0'; // From user message
    const localKey = process.env.GEMINI_API_KEY; // From .env
    
    console.log("Testing Vercel Key...");
    try {
        const genAI1 = new GoogleGenerativeAI(vercelKey);
        const model1 = genAI1.getGenerativeModel({ model: 'gemini-3.1-pro-preview' });
        await model1.generateContent("Hello");
        console.log("Vercel key SUCCESS");
    } catch (e) {
        console.log("Vercel key FAILED:", e.message);
    }
    
    console.log("\nTesting Local Key...");
    try {
        const genAI2 = new GoogleGenerativeAI(localKey);
        const model2 = genAI2.getGenerativeModel({ model: 'gemini-3.1-pro-preview' });
        await model2.generateContent("Hello");
        console.log("Local key SUCCESS");
    } catch (e) {
        console.log("Local key FAILED:", e.message);
    }
}

testKeys();
