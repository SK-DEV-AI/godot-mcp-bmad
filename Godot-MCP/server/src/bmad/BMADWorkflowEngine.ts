import fs from 'fs/promises';
import path from 'path';
import yaml from 'js-yaml';
import { BaseLlmClient } from '../llm-connectors/base_client';

// Helper to load and parse a BMAD agent definition from the expansion pack
async function loadAgentPrompt(agentFileName: string): Promise<string> {
    try {
        // Use process.cwd() to get the project root and build a reliable path
        const fullPath = path.resolve(process.cwd(), `expansion-packs/bmad-godot-game-dev/agents/${agentFileName}`);
        const fileContent = await fs.readFile(fullPath, 'utf-8');

        const yamlMatch = fileContent.match(/```yaml([\s\S]*?)```/);
        if (!yamlMatch) {
            return fileContent; // Fallback for simple markdown prompts
        }

        const yamlContent = yaml.load(yamlMatch[1]);
        if (typeof yamlContent !== 'object' || yamlContent === null || !('persona' in yamlContent)) {
            throw new Error(`Invalid BMAD agent file format in ${agentFileName}: missing persona section.`);
        }

        const persona = (yamlContent as any).persona;
        // Construct a detailed prompt from the persona
        return `Your persona:
Role: ${persona.role}
Style: ${persona.style}
Identity: ${persona.identity}
Focus: ${persona.focus}

Your task is to respond to the user's request based on this persona. Do not deviate from this role.`;

    } catch (error: any) {
        console.error(`ERROR: Could not load or parse agent prompt from ${agentFileName}: ${error.message}`);
        return 'You are a helpful assistant.'; // Fallback prompt
    }
}

export class BMADWorkflowEngine {
    private llmClient: BaseLlmClient;
    private analystPrompt: string = '';
    private architectPrompt: string = '';
    private developerPrompt: string = '';

    constructor(llmClient: BaseLlmClient) {
        this.llmClient = llmClient;
    }

    private async loadAllPrompts(): Promise<void> {
        if (this.analystPrompt && this.architectPrompt && this.developerPrompt) return;

        console.log("Loading BMAD agent personas from Godot expansion pack...");
        this.analystPrompt = await loadAgentPrompt('game-analyst.md');
        this.architectPrompt = await loadAgentPrompt('game-architect.md');

        // Fix the developer prompt path to be relative to the project root
        const devPromptPath = path.resolve(process.cwd(), 'Godot-MCP/server/src/bmad/prompts/godot_developer.md');
        this.developerPrompt = await fs.readFile(devPromptPath, 'utf-8');
    }

    public async runWorkflow(initialUserPrompt: string): Promise<string> {
        await this.loadAllPrompts();
        console.log("--- Starting Full BMAD Workflow Simulation ---");

        console.log("Step 1: Game Analyst refining user story...");
        const userStory = await this.llmClient.generatePlan(this.analystPrompt, `Refine the following user request into a user story: "${initialUserPrompt}"`);
        console.log("Analyst output (User Story):", userStory);

        console.log("\nStep 2: Game Architect creating technical plan...");
        const techPlan = await this.llmClient.generatePlan(this.architectPrompt, `Create a Godot-specific technical plan for the following user story: "${userStory}"`);
        console.log("Architect output (Technical Plan):", techPlan);

        console.log("\nStep 3: Game Developer generating final JSON command plan...");
        const jsonPlan = await this.llmClient.generatePlan(this.developerPrompt, `Create a machine-readable JSON command plan for the following technical plan: "${techPlan}"`);
        console.log("Developer output (JSON Plan):", jsonPlan);

        console.log("--- BMAD Workflow Complete ---");
        return jsonPlan;
    }

    public async getCorrectedPlan(failedPlan: any, errorMessage: string): Promise<string> {
        await this.loadAllPrompts();
        console.log("--- Starting BMAD Correction Workflow ---");

        const correctionRequest = `
The previous execution plan failed. Your task is to analyze the error and provide a new, corrected JSON plan that fixes the issue.
Original Plan that Failed:
${JSON.stringify(failedPlan, null, 2)}
The error message from the server was:
${errorMessage}
Please provide a full, new JSON array of commands that corrects this error and still accomplishes the original goal. Do not include any explanations or markdown, only the raw JSON array.`;

        console.log("Generating corrected plan...");
        const correctedJsonPlan = await this.llmClient.generatePlan(this.developerPrompt, correctionRequest);
        console.log("--- BMAD Correction Complete ---");
        return correctedJsonPlan;
    }
}
