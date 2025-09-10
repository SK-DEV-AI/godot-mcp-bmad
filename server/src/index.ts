import { FastMCP } from 'fastmcp';
import { nodeTools } from './tools/node_tools.js';
import { scriptTools } from './tools/script_tools.js';
import { sceneTools } from './tools/scene_tools.js';
import { editorTools } from './tools/editor_tools.js';
import { getGodotConnection } from './utils/godot_connection.js';

// Import resources
import { 
  sceneListResource, 
  sceneStructureResource 
} from './resources/scene_resources.js';
import { 
  scriptResource, 
  scriptListResource,
  scriptMetadataResource 
} from './resources/script_resources.js';
import { 
  projectStructureResource,
  projectSettingsResource,
  projectResourcesResource 
} from './resources/project_resources.js';
import { 
  editorStateResource,
  selectedNodeResource,
  currentScriptResource 
} from './resources/editor_resources.js';

// Headless execution imports from other version
import { existsSync, readdirSync } from 'fs';
import { spawn, exec } from 'child_process';
import { promisify } from 'util';
const execAsync = promisify(exec);

// Headless Godot config from other version
const DEBUG_MODE = process.env.DEBUG === 'true';
const GODOT_DEBUG_MODE = true;
let godotPath: string | null = null;
let activeProcess: any = null;
const operationsScriptPath = '../scripts/godot_operations.gd'; // Adjusted relative path

interface GodotProcess {
  process: any;
  output: string[];
  errors: string[];
}

interface OperationParams {
  [key: string]: any;
}

interface GodotServerConfig {
  godotPath?: string;
  debugMode?: boolean;
  strictPathValidation?: boolean;
}

class HeadlessGodotExecutor {
  private validatedPaths = new Map<string, boolean>();
  private strictPathValidation = false;
  private parameterMappings: Record<string, string> = {
    'project_path': 'projectPath',
    'scene_path': 'scenePath',
    'root_node_type': 'rootNodeType',
    'parent_node_path': 'parentNodePath',
    'node_type': 'nodeType',
    'node_name': 'nodeName',
    'texture_path': 'texturePath',
    'node_path': 'nodePath',
    'output_path': 'outputPath',
    'mesh_item_names': 'meshItemNames',
    'new_path': 'newPath',
    'file_path': 'filePath',
    'directory': 'directory',
    'recursive': 'recursive',
    'scene': 'scene',
  };
  private reverseParameterMappings: Record<string, string> = {};

  constructor(config?: GodotServerConfig) {
    for (const [snakeCase, camelCase] of Object.entries(this.parameterMappings)) {
      this.reverseParameterMappings[camelCase] = snakeCase;
    }
    if (config) {
      if (config.strictPathValidation !== undefined) {
        this.strictPathValidation = config.strictPathValidation;
      }
      if (config.godotPath) {
        godotPath = config.godotPath;
      }
    }
  }

  private logDebug(message: string): void {
    if (DEBUG_MODE) console.debug(`[HEADLESS DEBUG] ${message}`);
  }

  async detectGodotPath(): Promise<void> {
    if (godotPath && await this.isValidGodotPath(godotPath)) return;
    if (process.env.GODOT_PATH) {
      const normalizedPath = process.env.GODOT_PATH;
      if (await this.isValidGodotPath(normalizedPath)) {
        godotPath = normalizedPath;
        return;
      }
    }
    // Auto-detect logic (simplified)
    const possiblePaths = ['godot'];
    for (const path of possiblePaths) {
      if (await this.isValidGodotPath(path)) {
        godotPath = path;
        return;
      }
    }
    throw new Error('Could not find Godot executable');
  }

  private async isValidGodotPath(path: string): Promise<boolean> {
    if (this.validatedPaths.has(path)) return this.validatedPaths.get(path)!;
    try {
      if (path !== 'godot' && !existsSync(path)) return false;
      await execAsync(path === 'godot' ? 'godot --version' : `"${path}" --version`);
      this.validatedPaths.set(path, true);
      return true;
    } catch {
      this.validatedPaths.set(path, false);
      return false;
    }
  }

  private normalizeParameters(params: OperationParams): OperationParams {
    return params; // Simplified
  }

  private convertCamelToSnakeCase(params: OperationParams): OperationParams {
    return params; // Simplified
  }

  async executeOperation(operation: string, params: OperationParams, projectPath: string): Promise<{ stdout: string; stderr: string }> {
    await this.detectGodotPath();
    if (!godotPath) throw new Error('No Godot path');
    const snakeCaseParams = this.convertCamelToSnakeCase(params);
    const paramsJson = JSON.stringify(snakeCaseParams);
    const quotedParams = process.platform === 'win32' ? `"${paramsJson.replace(/"/g, '\\"')}"` : `'${paramsJson.replace(/'/g, "'\\''")}'`;
    const debugArgs = GODOT_DEBUG_MODE ? ['--debug-godot'] : [];
    const cmd = `"${godotPath}" --headless --path "${projectPath}" --script "${operationsScriptPath}" ${operation} ${quotedParams} ${debugArgs.join(' ')}`;
    this.logDebug(`Executing headless command: ${cmd}`);
    return execAsync(cmd);
  }

  async launchEditor(projectPath: string): Promise<string> {
    await this.detectGodotPath();
    spawn(godotPath!, ['-e', '--path', projectPath], { stdio: 'pipe' });
    return `Launched Godot editor for project: ${projectPath}`;
  }

  async runProject(projectPath: string, scene?: string): Promise<string> {
    if (activeProcess) activeProcess.process.kill();
    const cmdArgs = ['-d', '--path', projectPath];
    if (scene) cmdArgs.push(scene);
    activeProcess = spawn(godotPath!, cmdArgs, { stdio: 'pipe' });
    return `Started project: ${projectPath}${scene ? `, scene: ${scene}` : ''}`;
  }

  getDebugOutput(): string {
    const output = activeProcess ? { output: [], errors: [] } : { output: [], errors: [] };
    return JSON.stringify(output, null, 2);
  }

  stopProject(): string {
    if (activeProcess) {
      activeProcess.process.kill();
      activeProcess = null;
      return 'Stopped Godot project';
    }
    return 'No active project to stop';
  }
}

// Combined tools with string returns
const allTools = [...nodeTools, ...scriptTools, ...sceneTools, ...editorTools, {
  name: 'launch_editor',
  description: 'Launch Godot editor (headless fallback)',
  inputSchema: { type: 'object', properties: { projectPath: { type: 'string' } }, required: ['projectPath'] },
  execute: async (args: { projectPath: string }) => new HeadlessGodotExecutor().launchEditor(args.projectPath),
}, {
  name: 'run_project',
  description: 'Run Godot project (headless fallback)',
  inputSchema: { type: 'object', properties: { projectPath: { type: 'string' }, scene: { type: 'string' } }, required: ['projectPath'] },
  execute: async (args: { projectPath: string, scene?: string }) => new HeadlessGodotExecutor().runProject(args.projectPath, args.scene),
}, {
  name: 'get_debug_output',
  description: 'Get debug output (headless fallback)',
  inputSchema: { type: 'object', properties: {} },
  execute: async () => new HeadlessGodotExecutor().getDebugOutput(),
}, {
  name: 'stop_project',
  description: 'Stop running project (headless fallback)',
  inputSchema: { type: 'object', properties: {} },
  execute: async () => new HeadlessGodotExecutor().stopProject(),
}];

// Combined resources
const allResources = [
  sceneListResource, sceneStructureResource, scriptResource, scriptListResource, scriptMetadataResource,
  projectStructureResource, projectSettingsResource, projectResourcesResource, editorStateResource,
  selectedNodeResource, currentScriptResource
];

/**
 * Main entry point for the unified Godot MCP server
 */
async function main() {
  console.error('Starting Unified Godot MCP server...');

  // Initialize headless executor
  const headlessExecutor = new HeadlessGodotExecutor({ strictPathValidation: false });
  await headlessExecutor.detectGodotPath().catch(err => console.error('Headless Godot detection failed:', err));

  // Create FastMCP instance
  const server = new FastMCP({
    name: 'GodotMCP-Unified',
    version: '1.1.0',
  });

  // Register tools and resources
  allTools.forEach(tool => server.addTool(tool));
  allResources.forEach(resource => server.addResource(resource));

  // Try WS connection for live editor
  try {
    const godot = getGodotConnection();
    await godot.connect();
    console.error('Connected to Godot editor via WebSocket');
  } catch (error) {
    console.warn('No live Godot connection, using headless fallback:', error);
  }

  // Start the server
  server.start({ transportType: 'stdio' });
  console.error('Unified Godot MCP server started');

  // Cleanup
  const cleanup = () => {
    console.error('Shutting down Godot MCP server...');
    if (activeProcess) activeProcess.process.kill();
    const godot = getGodotConnection();
    godot.disconnect();
    process.exit(0);
  };
  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
}

// Start the server
main().catch(error => {
  console.error('Failed to start Unified Godot MCP server:', error);
  process.exit(1);
});
