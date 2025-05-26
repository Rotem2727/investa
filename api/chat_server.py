import socket
import threading

HOST = '127.0.0.1'
PORT = 8821

clients = []
client_names = {}

def broadcast(message, sender_address=None):
    """Sends a message to all connected clients."""
    for client_socket in clients:
        try:
            # Don't send the message back to the sender if sender_address is provided
            if sender_address and client_socket.getpeername() == sender_address:
                continue
            client_socket.send(message)
        except Exception as e:
            print(f"Error broadcasting message to a client: {e}")
            remove_client(client_socket)

def handle_client(client_socket, client_address):
    """Handles communication with a single client."""
    print(f"[NEW CONNECTION] {client_address} connected.")

    # Ask for username
    client_socket.send("Enter your username: ".encode('utf-8'))
    try:
        username = client_socket.recv(1024).decode('utf-8').strip()
        client_names[client_socket] = username
        welcome_message = f"Welcome, {username}! You are now in the chat.\n".encode('utf-8')
        client_socket.send(welcome_message)
        broadcast(f"{username} has joined the chat.".encode('utf-8'))
    except Exception as e:
        print(f"Error getting username from {client_address}: {e}")
        remove_client(client_socket)
        return

    while True:
        try:
            message = client_socket.recv(1024).decode('utf-8')
            if message:
                formatted_message = f"[{client_names[client_socket]}] {message}".encode('utf-8')
                print(f"Received from {client_names[client_socket]}: {message}")
                broadcast(formatted_message, client_address)
            else:
                # Client disconnected
                remove_client(client_socket)
                break
        except Exception as e:
            print(f"Error handling client {client_address}: {e}")
            remove_client(client_socket)
            break

def remove_client(client_socket):
    """Removes a client from the list and broadcasts their departure."""
    if client_socket in clients:
        clients.remove(client_socket)
        if client_socket in client_names:
            username = client_names[client_socket]
            print(f"[DISCONNECTION] {username} has left the chat.")
            broadcast(f"{username} has left the chat.".encode('utf-8'))
            del client_names[client_socket]
        client_socket.close()

def start_server():
    """Starts the TCP chat server."""
    server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    server.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    server.bind((HOST, PORT))
    server.listen()
    print(f"Server listening on {HOST}:{PORT}")

    while True:
        conn, addr = server.accept()
        clients.append(conn)
        thread = threading.Thread(target=handle_client, args=(conn, addr))
        thread.start()
        print(f"[ACTIVE CONNECTIONS] {threading.active_count() - 1}")

if __name__ == "__main__":
    start_server()
