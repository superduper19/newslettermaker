const { Anthropic } = require('@anthropic-ai/sdk');
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function test() {
    try {
        console.log("Testing invalid model name...");
        const response = await anthropic.messages.create({
            model: "claude-opus-4-8",
            max_tokens: 100,
            messages: [{ role: "user", content: "hello" }]
        }, { timeout: 10000 });
        console.log("Response:", response);
    } catch (err) {
        console.error("Error name:", err.name);
        console.error("Error message:", err.message);
    }
}
test();
