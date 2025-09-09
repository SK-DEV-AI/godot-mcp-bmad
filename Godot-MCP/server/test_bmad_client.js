import { spawn } from 'child_process';
import path from 'path';

// Since this script is in the same directory as dist/, we can use relative paths
const serverPath = path.resolve(__dirname, 'dist/index.js');
const serverProcess = spawn('node', [serverPath], { stdio: ['pipe', 'pipe', 'pipe'] });

let requestId = 1;

function sendRequest(method, params) {
    const request = {
        jsonrpc: '2.0',
        method: method,
        params: params,
        id: requestId++,
    };
    const message = JSON.stringify(request) + '\n';
    console.log(`\n>>> CLIENT: Sending request:`, message);
    serverProcess.stdin.write(message);
}

serverProcess.stdout.on('data', (data) => {
    console.log(`<<< SERVER STDOUT:`, data.toString());
});

serverProcess.stderr.on('data', (data) => {
    console.error(`<<< SERVER STDERR:`, data.toString());
});

serverProcess.on('close', (code) => {
    console.log(`\nServer process exited with code ${code}`);
});

// Give the server a moment to start up
setTimeout(() => {
    console.log("--- Starting test ---");
    sendRequest('bmad-execute-prompt', {
        prompt: "Create a simple scene with a single Sprite2D node.",
        llm_provider: "ollama" // Use ollama to avoid needing real API keys for the test
    });
}, 3000); // Wait 3 seconds for the server to initialize

// Terminate the test after a while
setTimeout(() => {
    console.log("\n--- Test finished ---");
    serverProcess.kill();
}, 20000); // Let it run for 20 seconds
