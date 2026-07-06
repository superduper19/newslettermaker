require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

async function testLocalBig() {
    const localKey = process.env.GEMINI_API_KEY;
    console.log(`\nTesting Local Key...`);
    try {
        const genAI = new GoogleGenerativeAI(localKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-3.1-pro-preview' });
        
        const prompt = "Please write a 5000 word essay about the history of the roman empire. " + "A ".repeat(10000);
        console.log(`Sending large request to gemini-3.1-pro-preview...`);
        const result = await model.generateContent(prompt);
        console.log("SUCCESS:", result.response.text().substring(0, 50) + "...");
    } catch (e) {
        console.error(`FAILED with Local Key:`, e.message);
    }
}

testLocalBig();
