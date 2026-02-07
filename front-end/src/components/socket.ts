import { io, Socket } from "socket.io-client";


const SOCKET_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:3001";

const socket: Socket = io(SOCKET_URL, {
    transports: ["websocket"],
});

export default socket;