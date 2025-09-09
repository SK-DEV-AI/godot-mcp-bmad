import fetch from 'node-fetch';
import { BaseLlmClient } from './base_client';

export class OllamaClient implements BaseLlmClient {
    private readonly baseUrl: string;
    private readonly model: string;
    private readonly url: string;

    constructor() {
        this.baseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
        this.model = process.env.OLLAMA_MODEL || 'llama3';
        this.url = `${this.baseUrl}/api/generate`;
    }

    async generatePlan(systemPrompt: string, userPrompt: string): Promise<string> {
        const payload = {
            model: this.model,
            system: systemPrompt,
            prompt: userPrompt,
            format: 'json',
            stream: false,
        };

        const response = await fetch(this.url, {
            method: 'POST',
            body: JSON.stringify(payload),
            headers: { 'Content-Type': 'application/json' },
        });

        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`Ollama API request failed with status ${response.status}: ${errorBody}`);
        }

        const jsonResponse = await response.json() as { response: string };
        return jsonResponse.response;
    }
}
