import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from '@google/genai';
import { BaseLlmClient } from './base_client';

export class GeminiClient implements BaseLlmClient {
    private readonly model: any; // The type is GenerativeModel, but using any to avoid import complexity

    constructor() {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey || apiKey.includes('YOUR_GEMINI_API_KEY_HERE')) {
            throw new Error('Gemini API key is missing or not set in .env file');
        }
        // Correct instantiation based on documentation
        const genAI = new GoogleGenAI(apiKey);
        this.model = genAI.getGenerativeModel({
            model: process.env.GEMINI_MODEL || 'gemini-1.5-pro-latest'
        });
    }

    async generatePlan(systemPrompt: string, userPrompt: string): Promise<string> {
        // The modern SDK has a systemInstruction field for system prompts
        const result = await this.model.generateContent({
            contents: [{ role: "user", parts: [{ text: userPrompt }] }],
            systemInstruction: {
                role: "system",
                parts: [{ text: systemPrompt }],
            },
            generationConfig: {
                responseMimeType: "application/json",
                temperature: 0,
            },
            safetySettings: [
                { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
                { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
                { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
                { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
            ]
        });

        const response = result.response;
        return response.text();
    }
}
