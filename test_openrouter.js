require('dotenv').config();
const OpenAI = require('openai');

const openrouter = new OpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: process.env.OPENROUTER_API_KEY,
});

async function test() {
    try {
        console.log("Sending request to openrouter with z-ai/glm-5.2...");
        const response = await openrouter.chat.completions.create({
            model: 'z-ai/glm-5.2',
            messages: [{ role: 'system', content: 'You only output JSON.' }, { role: 'user', content: 'Say {"hello":"world"}!' }],
        });
        console.log("Response:", response.choices[0]?.message?.content);
    } catch (e) {
        console.error("Error:", e.message, e.response?.data);
    }
}
test();
