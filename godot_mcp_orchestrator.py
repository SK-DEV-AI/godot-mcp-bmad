import json
import itertools
import websockets

class GodotMcpOrchestrator:
    """
    Connects to a JSON-RPC 2.0 server over WebSockets and executes a list of commands.
    """

    def __init__(self):
        self._id_counter = itertools.count(1)

    async def execute_plan(self, command_list: list, server_uri: str):
        """
        Connects to the Godot MCP server and executes a list of commands.
        """
        print(f"Connecting to Godot MCP server at {server_uri}...")
        try:
            async with websockets.connect(server_uri) as websocket:
                print("Connection established.")

                # FIX #3: Consume the initial 'welcome' message from the server.
                welcome_message = await websocket.recv()
                print(f"Server handshake complete. Received: {welcome_message}")

                print("Executing commands...")
                for i, command_data in enumerate(command_list):
                    method = command_data.get("command")
                    params = command_data.get("parameters", {})

                    if not method:
                        print(f"Error: Command at index {i} is missing 'command' key. Halting.")
                        return

                    request_id = next(self._id_counter)
                    payload = {
                        "jsonrpc": "2.0",
                        "method": method,
                        "params": params,
                        "id": request_id,
                    }

                    print(f"Executing command {i+1}/{len(command_list)}: {method}")
                    await websocket.send(json.dumps(payload))

                    response_str = await websocket.recv()
                    response = json.loads(response_str)

                    if response.get("id") != request_id:
                        print(f"DEBUG: Raw server response: {response}")
                        print(f"Error: Received response for unexpected ID. Expected {request_id}, got {response.get('id')}. Halting.")
                        return

                    if "error" in response:
                        print("\n--- EXECUTION FAILED ---")
                        print(f"Error executing command: {method}")
                        print(f"Parameters: {json.dumps(params, indent=2)}")
                        print(f"Server error: {json.dumps(response['error'], indent=2)}")
                        print("--------------------------")
                        return

                    print(f"Command '{method}' executed successfully.")

                print("\nExecution completed successfully.")

        except websockets.exceptions.ConnectionClosed as e:
            print(f"\nError: Connection to the server failed or was closed: {e}")
            print("Please ensure the Godot MCP server is running in your Godot project.")
        except Exception as e:
            print(f"\nAn unexpected error occurred: {e}")
