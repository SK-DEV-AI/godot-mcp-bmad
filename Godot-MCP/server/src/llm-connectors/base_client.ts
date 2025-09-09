export interface BaseLlmClient {
    generatePlan(systemPrompt: string, userPrompt: string): Promise<string>;
}
