import { FastMCP, McpTool } from 'fastmcp';
import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config({ path: '../../.env' });

import { nodeTools } from './tools/node_tools.js';
import { scriptTools } from './tools/script_tools.js';
import { sceneTools } from './tools/scene_tools.js';
import { editorTools } from './tools/editor_tools.js';
import { getGodotConnection } from './utils/godot_connection.js';

import { BMADWorkflowEngine } from './bmad/BMADWorkflowEngine.js';
import { BaseLlmClient } from './llm-connectors/base_client.js';
import { OpenAIClient } from './llm-connectors/openai_client.js';
import { GroqClient } from './llm-connectors/groq_client.js';
import { OpenRouterClient } from './llm-connectors/openrouter_client.js';
import { OllamaClient } from './llm-connectors/ollama_client.js';

import { sceneListResource, sceneStructureResource } from './resources/scene_resources.js';
import { scriptResource, scriptListResource, scriptMetadataResource } from './resources/script_resources.js';
import { projectStructureResource, projectSettingsResource, projectResourcesResource } from './resources/project_resources.js';
import { editorStateResource, selectedNodeResource, currentScriptResource } from './resources/editor_resources.js';

const MAX_RETRIES = 3;

async function main() {
  console.error('Starting Godot MCP server...');

  const server = new FastMCP({
    name: 'GodotMCP-BMAD-Enhanced',
    version: '2.0.0',
  });

  const bmadExecutePromptTool: McpTool = {
    name: 'bmad-execute-prompt',
    description: 'Takes a high-level prompt and uses the BMAD agent workflow to generate and execute a command plan.',
    schema: z.object({
      prompt: z.string().describe('The high-level user request.'),
      llm_provider: z.enum(['openai', 'groq', 'openrouter', 'ollama']).default('ollama').describe('The LLM provider to use.'),
    }),
    handler: async (params) => {
      console.log(`Received bmad-execute-prompt with provider: ${params.llm_provider}`);

      const clientMap: { [key: string]: new () => BaseLlmClient } = {
          openai: OpenAIClient, groq: GroqClient,
          openrouter: OpenRouterClient, ollama: OllamaClient,
      };

      const ClientClass = clientMap[params.llm_provider];
      if (!ClientClass) throw new Error(`Invalid LLM provider specified: ${params.llm_provider}`);

      const llmClient = new ClientClass();
      const workflowEngine = new BMADWorkflowEngine(llmClient);

      let lastError: string | null = null;
      let currentPlan: any[] = [];

      try {
        const initialPlanStr = await workflowEngine.runWorkflow(params.prompt);
        currentPlan = JSON.parse(initialPlanStr);
      } catch (error: any) {
        throw new Error(`Failed to generate initial plan: ${error.message}`);
      }

      for (let i = 0; i < MAX_RETRIES; i++) {
        console.log(`\n--- EXECUTION ATTEMPT ${i + 1}/${MAX_RETRIES} ---`);
        let executionFailed = false;
        let failedCommand = null;

        for (const command of currentPlan) {
            try {
                console.log(`Executing command: ${command.command}`, command.parameters);
                await server.callTool(command.command, command.parameters);
            } catch (error: any) {
                console.error(`Command failed: ${command.command}`, error.message);
                lastError = error.message;
                failedCommand = command;
                executionFailed = true;
                break;
            }
        }

        if (!executionFailed) {
            console.log("\n--- ✅ PLAN EXECUTED SUCCESSFULLY ---");
            return { success: true, message: "Plan executed successfully." };
        }

        console.log("\n--- ⚠️ PLAN EXECUTION FAILED ---");
        if (i < MAX_RETRIES - 1) {
            try {
                console.log("Requesting a corrected plan from the LLM...");
                const correctedPlanStr = await workflowEngine.getCorrectedPlan(currentPlan, lastError!);
                currentPlan = JSON.parse(correctedPlanStr);
            } catch (error: any) {
                throw new Error(`Failed to generate corrected plan: ${error.message}`);
            }
        }
      }

      throw new Error(`Plan execution failed after ${MAX_RETRIES} attempts. Last error: ${lastError}`);
    },
  };

  [...nodeTools, ...scriptTools, ...sceneTools, ...editorTools, bmadExecutePromptTool].forEach(tool => {
    server.addTool(tool as McpTool);
  });

  [sceneListResource, sceneStructureResource, scriptResource, scriptListResource, scriptMetadataResource, projectStructureResource, projectSettingsResource, projectResourcesResource, editorStateResource, selectedNodeResource, currentScriptResource].forEach(resource => {
    server.addResource(resource);
  });

  try {
    const godot = getGodotConnection();
    await godot.connect();
    console.error('Successfully connected to Godot WebSocket server');
  } catch (error) {
    const err = error as Error;
    console.warn(`Could not connect to Godot: ${err.message}`);
    console.warn('Will retry connection when commands are executed');
  }

  server.start({
    transportType: 'stdio',
  });

  console.error('Godot MCP server with BMAD integration started');

  const cleanup = () => {
    console.error('Shutting down Godot MCP server...');
    getGodotConnection().disconnect();
    process.exit(0);
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
}

main().catch(error => {
  console.error('Failed to start Godot MCP server:', error);
  process.exit(1);
});
