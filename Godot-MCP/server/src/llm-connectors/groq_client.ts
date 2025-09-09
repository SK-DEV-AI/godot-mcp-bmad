import Groq from 'groq-sdk';
import { BaseLlmClient } from './base_client';

export class GroqClient implements BaseLlmClient {
    private readonly client: Groq;
    private readonly model: string;

    constructor() {
        const apiKey = process.env.GROQ_API_KEY;
        this.model = process.env.GROQ_MODEL || 'llama3-70b-8192';

        if (!apiKey || apiKey.includes('YOUR_GROQ_API_KEY_HERE')) {
            throw new Error('Groq API key is missing or not set in .env file');
        }
        this.client = new Groq({ apiKey });
    }

    async generatePlan(systemPrompt: string, userPrompt: string): Promise<string> {
        const response = await this.client.chat.completions.create({
            model: this.model,
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt },
            ],
            response_format: { type: "json_object" },
        });
        return response.choices[0].message.content || '';
    }
}
