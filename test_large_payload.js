require('dotenv').config();
const OpenAI = require('openai');

const openrouter = new OpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: process.env.OPENROUTER_API_KEY,
});

async function test() {
    try {
        const rawResults = "Title: Sample Article\\nDescription: This is a test.\\nURL: https://example.com\\n".repeat(500); // about 40k characters
        
        const extractPrompt = `You are a data extraction assistant that only outputs valid JSON arrays. No markdown, no conversational text.
        Parse this text and extract:
        ${rawResults}`;

        console.log("Sending large request to openrouter with z-ai/glm-5.2...");
        const start = Date.now();
        const response = await openrouter.chat.completions.create({
            model: 'z-ai/glm-5.2',
            messages: [
                { role: 'system', content: "You are a data extraction assistant that only outputs valid JSON arrays. No markdown, no conversational text." },
                { role: 'user', content: extractPrompt }
            ]
        }, { timeout: 30000 });
        console.log("Response in", Date.now() - start, "ms:", response.choices[0]?.message?.content?.substring(0, 100));
    } catch (e) {
        console.error("Error:", e.message);
    }
}
test();
