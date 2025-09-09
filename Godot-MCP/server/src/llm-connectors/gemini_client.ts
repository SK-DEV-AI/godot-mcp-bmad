import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/genai';
import { BaseLlmClient } from './base_client';

export class GeminiClient implements BaseLlmClient {
    private readonly client: GoogleGenerativeAI;
    private readonly model: string;

    constructor() {
        const apiKey = process.env.GEMINI_API_KEY;
        this.model = process.env.GEMINI_MODEL || 'gemini-1.5-pro-latest';

        if (!apiKey || apiKey.includes('YOUR_GEMINI_API_KEY_HERE')) {
            throw new Error('Gemini API key is missing or not set in .env file');
        }
        this.client = new GoogleGenerativeAI(apiKey);
    }

    async generatePlan(systemPrompt: string, userPrompt: string): Promise<string> {
        const model = this.client.getGenerativeModel({
            model: this.model,
            // System instructions are a new feature and might be the best place for the system prompt
            systemInstruction: systemPrompt,
        });

        const result = await model.generateContent({
            contents: [{ role: "user", parts: [{ text: userPrompt }] }],
            generationConfig: {
                responseMimeType: "application/json",
                temperature: 0,
            },
            // Safety settings are important for Gemini
            safetySettings: [
                {
                    category: HarmCategory.HARM_CATEGORY_HARASSMENT,
                    threshold: HarmBlockThreshold.BLOCK_NONE,
                },
                {
                    category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
                    threshold: HarmBlockThreshold.BLOCK_NONE,
                },
                {
                    category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
                    threshold: HarmBlockThreshold.BLOCK_NONE,
                },
                {
                    category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
                    threshold: HarmBlockThreshold.BLOCK_NONE,
                },
            ]
        });

        const response = result.response;
        const text = response.text();
        return text;
    }
}
