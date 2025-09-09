import OpenAI from 'openai'; // OpenRouter uses an OpenAI-compatible API
import { BaseLlmClient } from './base_client';

export class OpenRouterClient implements BaseLlmClient {
    private readonly client: OpenAI;
    private readonly model: string;

    constructor() {
        const apiKey = process.env.OPENROUTER_API_KEY;
        const baseUrl = process.env.OPENROUTER_BASE_URL;
        this.model = process.env.OPENROUTER_MODEL || 'anthropic/claude-3-haiku';

        if (!apiKey || apiKey.includes('YOUR_OPENROUTER_API_KEY_HERE')) {
            throw new Error('OpenRouter API key is missing or not set in .env file');
        }
        this.client = new OpenAI({ apiKey, baseURL: baseUrl });
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
