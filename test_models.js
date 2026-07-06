require('dotenv').config();

async function test() {
    try {
        const response = await fetch('https://openrouter.ai/api/v1/models', {
            headers: { 'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}` }
        });
        const data = await response.json();
        const zhipuModels = data.data.filter(m => m.id.toLowerCase().includes('zhipu') || m.id.toLowerCase().includes('glm'));
        console.log("Zhipu Models:", zhipuModels.map(m => m.id));
    } catch (e) {
        console.error("Error:", e.message);
    }
}
test();
