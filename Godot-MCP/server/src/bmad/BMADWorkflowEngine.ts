import fs from 'fs/promises';
import path from 'path';
import { BaseLlmClient } from '../llm-connectors/base_client';

// Simplified prompts derived from the full agent markdown files
const ANALYST_PROMPT = `You are an insightful analyst. Your role is to take a high-level user request and refine it into a clear, structured user story. Focus on clarifying the core requirements and acceptance criteria. Output only the user story, without any additional text or explanation.`;

const ARCHITECT_PROMPT = `You are a holistic system architect. Your role is to take a user story and create a high-level technical plan. Describe the necessary scenes, nodes, scripts, and their relationships. Do not write code. Focus on the structural design. Output only the technical plan.`;

export class BMADWorkflowEngine {
    private llmClient: BaseLlmClient;
    private developerPrompt: string = '';

    constructor(llmClient: BaseLlmClient) {
        this.llmClient = llmClient;
    }

    private async loadDeveloperPrompt(): Promise<void> {
        if (this.developerPrompt) return;
        // The prompt is now co-located with the server source
        const promptPath = path.resolve(__dirname, './prompts/godot_developer.md');
        try {
            this.developerPrompt = await fs.readFile(promptPath, 'utf-8');
        } catch (error) {
            console.error(`FATAL: Could not load developer prompt from ${promptPath}`, error);
            this.developerPrompt = 'You are a helpful assistant that provides JSON output.';
        }
    }

    public async runWorkflow(initialUserPrompt: string): Promise<string> {
        console.log("--- Starting BMAD Workflow ---");
        await this.loadDeveloperPrompt();

        console.log("Step 1: Analyst refining user story...");
        const userStory = await this.llmClient.generatePlan(ANALYST_PROMPT, initialUserPrompt);
        console.log("Analyst output (User Story):", userStory);

        console.log("\nStep 2: Architect creating technical plan...");
        const techPlan = await this.llmClient.generatePlan(ARCHITECT_PROMPT, userStory);
        console.log("Architect output (Technical Plan):", techPlan);

        console.log("\nStep 3: Developer generating final JSON command plan...");
        const jsonPlan = await this.llmClient.generatePlan(this.developerPrompt, techPlan);
        console.log("Developer output (JSON Plan):", jsonPlan);

        console.log("--- BMAD Workflow Complete ---");
        return jsonPlan;
    }

    public async getCorrectedPlan(failedPlan: any, errorMessage: string): Promise<string> {
        console.log("--- Starting BMAD Correction Workflow ---");
        await this.loadDeveloperPrompt();

        const correctionRequest = `
The previous execution plan failed. Your task is to analyze the error and provide a new, corrected JSON plan that fixes the issue.

Original Plan that Failed:
${JSON.stringify(failedPlan, null, 2)}

The error message from the server was:
${errorMessage}

Please provide a full, new JSON array of commands that corrects this error and still accomplishes the original goal. Do not include any explanations or markdown, only the raw JSON array.
        `;

        console.log("Generating corrected plan...");
        const correctedJsonPlan = await this.llmClient.generatePlan(this.developerPrompt, correctionRequest);
        console.log("--- BMAD Correction Complete ---");
        return correctedJsonPlan;
    }
}
