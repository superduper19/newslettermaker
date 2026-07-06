const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

async function test() {
    try {
        console.log('Testing GoogleGenerativeAI with key from .env AND search tool');
        const genAI = new GoogleGenerativeAI((process.env.GEMINI_API_KEY || '').replace(/['"]/g, '').trim());
        const model = genAI.getGenerativeModel({ 
            model: 'gemini-3.1-pro-preview',
            tools: [{ googleSearch: {} }]
        });
        const result = await model.generateContent('What is the weather in Seattle today?');
        console.log('SUCCESS:', result.response.text());
    } catch (e) {
        console.error('ERROR:', e.message);
    }
}
test();
