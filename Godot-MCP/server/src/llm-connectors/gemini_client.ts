import { TextServiceClient } from "@google-ai/generativelanguage/build/src/v1beta2";
import { auth } from 'google-auth-library';
import { BaseLlmClient } from './base_client';

export class GeminiClient implements BaseLlmClient {
    private readonly client: TextServiceClient;
    private readonly model: string;

    constructor() {
        const apiKey = process.env.GEMINI_API_KEY;
        this.model = process.env.GEMINI_MODEL || 'models/text-bison-001'; // A common model for generateText

        if (!apiKey || apiKey.includes('YOUR_GEMINI_API_KEY_HERE')) {
            throw new Error('Gemini API key is missing or not set in .env file');
        }

        // The TextServiceClient uses google-auth-library for authentication.
        // We create an auth client that can hold the API key.
        this.client = new TextServiceClient({
            authClient: auth.fromAPIKey(apiKey),
        });
    }

    async generatePlan(systemPrompt: string, userPrompt: string): Promise<string> {
        // The generateText API doesn't have a dedicated system prompt field.
        // We combine them into a single prompt for the model.
        const combinedPrompt = `${systemPrompt}\n\nUser Request: ${userPrompt}`;

        const [response] = await this.client.generateText({
            model: this.model,
            prompt: {
                text: combinedPrompt,
            },
            // Settings to ensure JSON output if possible, though not guaranteed
            temperature: 0,
        });

        if (response.candidates && response.candidates.length > 0 && response.candidates[0].output) {
            return response.candidates[0].output;
        } else {
            throw new Error('Gemini API returned no candidates or empty output.');
        }
    }
}
