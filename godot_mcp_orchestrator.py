import json
import itertools
import websockets

class GodotMcpOrchestrator:
    """
    Connects to a JSON-RPC 2.0 server over WebSockets and executes a list of commands.
    Returns a dictionary indicating the outcome.
    """

    def __init__(self):
        self._id_counter = itertools.count(1)

    async def execute_plan(self, command_list: list, server_uri: str) -> dict:
        """
        Connects to the Godot MCP server and executes a list of commands.
        Returns a dictionary with a 'success' key. On failure, it includes
        'failed_command' and 'error_message'.
        """
        print(f"Connecting to Godot MCP server at {server_uri}...")
        try:
            async with websockets.connect(server_uri) as websocket:
                print("Connection established.")

                # Consume the initial 'welcome' message from the server.
                welcome_message = await websocket.recv()
                print(f"Server handshake complete. Received: {welcome_message}")

                print("Executing commands...")
                for i, command_data in enumerate(command_list):
                    method = command_data.get("command")
                    params = command_data.get("parameters", {})

                    if not method:
                        error_msg = f"Command at index {i} is missing 'command' key."
                        print(f"ERROR: {error_msg}")
                        return {'success': False, 'failed_command': command_data, 'error_message': error_msg}

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
                        error_msg = f"Received response for unexpected ID. Expected {request_id}, got {response.get('id')}."
                        print(f"ERROR: {error_msg}\nDEBUG: Raw server response: {response}")
                        return {'success': False, 'failed_command': command_data, 'error_message': error_msg}

                    if "error" in response:
                        error_msg = f"Server returned an error: {response['error'].get('message', 'Unknown error')}"
                        print(f"\n--- EXECUTION FAILED ---")
                        print(f"Error executing command: {method}")
                        print(f"Server error details: {json.dumps(response['error'], indent=2)}")
                        print("--------------------------")
                        return {'success': False, 'failed_command': command_data, 'error_message': error_msg}

                    print(f"Command '{method}' executed successfully.")

                print("\nExecution completed successfully.")
                return {'success': True}

        except websockets.exceptions.ConnectionClosed as e:
            error_msg = f"Connection to the server failed or was closed: {e}. Please ensure the Godot MCP server is running."
            print(f"\nERROR: {error_msg}")
            return {'success': False, 'failed_command': None, 'error_message': error_msg}
        except Exception as e:
            error_msg = f"An unexpected error occurred: {e}"
            print(f"\nERROR: {error_msg}")
            return {'success': False, 'failed_command': None, 'error_message': error_msg}
