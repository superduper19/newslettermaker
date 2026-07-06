require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

async function listModels() {
    const key = process.env.GEMINI_API_KEY || 'AIzaSyB4xvJy6E5fvL9ETGYo3hYRRrrbTpt3ye0';
    console.log("Using key:", key.substring(0, 10) + "...");
    
    try {
        // We can use fetch directly to hit the REST API to list models since the SDK doesn't have a direct list method exposed easily in all versions.
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
        const data = await response.json();
        
        if (data.models) {
            console.log("Available Gemini Models:");
            data.models.forEach(model => {
                if (model.name.includes('gemini')) {
                    console.log(`- ${model.name}`);
                }
            });
        } else {
            console.log("Error listing models:", data);
        }
    } catch (e) {
        console.error(`FAILED:`, e.message);
    }
}

listModels();
