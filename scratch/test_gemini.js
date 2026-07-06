require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

async function checkModels() {
    try {
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY);
        // Let's just try to generate content with one of the models
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
        const result = await model.generateContent("Hello");
        console.log(result.response.text());
        console.log("Success with gemini-1.5-flash");
    } catch (e) {
        console.error("Error with gemini-1.5-flash:", e.message);
    }

    try {
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY);
        const model = genAI.getGenerativeModel({ model: 'gemini-3.1-pro-preview' });
        const result = await model.generateContent("Hello");
        console.log(result.response.text());
        console.log("Success with gemini-3.1-pro-preview");
    } catch (e) {
        console.error("Error with gemini-3.1-pro-preview:", e.message);
    }
}

checkModels();
