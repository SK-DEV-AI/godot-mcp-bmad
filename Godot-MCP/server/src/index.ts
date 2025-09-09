import { FastMCP } from 'fastmcp';
import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config({ path: '../../.env' });

// Correctly import the local MCPTool type from its definition file
import { MCPTool } from './utils/types.js';

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
import { GeminiClient } from './llm-connectors/gemini_client.js';

import { sceneListResource, sceneStructureResource } from './resources/scene_resources.js';
import { scriptResource, scriptListResource, scriptMetadataResource } from './resources/script_resources.js';
import { projectStructureResource, projectSettingsResource, projectResourcesResource } from './resources/project_resources.js';
import { editorStateResource, selectedNodeResource, currentScriptResource } from './resources/editor_resources.js';

const MAX_RETRIES = 3;

// Combine all low-level tools into a single map for easy lookup
const allTools = [...nodeTools, ...scriptTools, ...sceneTools, ...editorTools];
const toolMap = new Map(allTools.map(tool => [tool.name, tool]));

async function main() {
  console.error('Starting Godot MCP server with full BMAD integration...');

  const server = new FastMCP({
    name: 'GodotMCP-BMAD-Intelligent-Server',
    version: '3.0.0',
  });

  // Define the schema for the tool parameters
  const bmadToolSchema = z.object({
    prompt: z.string().describe('The high-level user request.'),
  });
  // Infer the type from the schema for type safety
  type BmadToolParams = z.infer<typeof bmadToolSchema>;

  const bmadExecutePromptTool: MCPTool = {
    name: 'bmad-execute-prompt',
    description: 'Takes a high-level prompt and uses the full BMAD agent workflow to generate and execute a command plan.',
    // FIX: The property for parameters in the local MCPTool type is 'parameters', not 'schema'.
    parameters: bmadToolSchema,
    // Use the inferred type for the params to fix implicit 'any' error
    execute: async (params: BmadToolParams) => {
      const provider = process.env.DEFAULT_LLM_PROVIDER || 'ollama';
      console.log(`Received bmad-execute-prompt. Using server-configured provider: ${provider}`);

      const clientMap: { [key: string]: new () => BaseLlmClient } = {
          openai: OpenAIClient,
          groq: GroqClient,
          openrouter: OpenRouterClient,
          ollama: OllamaClient,
          gemini: GeminiClient
      };

      const ClientClass = clientMap[provider];
      if (!ClientClass) throw new Error(`Invalid LLM provider configured in .env: ${provider}`);

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

        for (const command of currentPlan) {
            const toolToExecute = toolMap.get(command.command);
            if (!toolToExecute) {
                lastError = `Command not found: ${command.command}`;
                executionFailed = true;
                break;
            }
            try {
                console.log(`Executing command: ${command.command}`, command.parameters);
                // FIX: The method to call is 'execute', not 'handler'.
                await toolToExecute.execute(command.parameters);
            } catch (error: any) {
                console.error(`Command failed: ${command.command}`, error.message);
                lastError = error.message;
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

  // Register all tools
  [...allTools, bmadExecutePromptTool].forEach(tool => {
    // FIX: The type name is MCPTool (all caps), not McpTool
    server.addTool(tool as MCPTool);
  });

  // Register all resources
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
