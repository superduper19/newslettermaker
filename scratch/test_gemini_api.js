const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

async function test() {
    try {
        console.log('Testing GoogleGenerativeAI with key from .env');
        const genAI = new GoogleGenerativeAI((process.env.GEMINI_API_KEY || '').replace(/['"]/g, '').trim());
        const model = genAI.getGenerativeModel({ model: 'gemini-3.5-flash' });
        const result = await model.generateContent('Say hello world');
        console.log('SUCCESS:', result.response.text());
    } catch (e) {
        console.error('ERROR:', e.message);
    }
}
test();
