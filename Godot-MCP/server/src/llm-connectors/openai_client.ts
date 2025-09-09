import OpenAI from 'openai';
import { BaseLlmClient } from './base_client';

export class OpenAIClient implements BaseLlmClient {
    private readonly client: OpenAI;
    private readonly model: string;

    constructor() {
        const apiKey = process.env.OPENAI_API_KEY;
        this.model = process.env.OPENAI_MODEL || 'gpt-4-turbo';

        if (!apiKey || apiKey.includes('YOUR_OPENAI_API_KEY_HERE')) {
            throw new Error('OpenAI API key is missing or not set in .env file');
        }
        this.client = new OpenAI({ apiKey });
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
