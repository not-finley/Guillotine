import { Link, useNavigate } from "react-router-dom";
import socket from "../../components/socket";
import { useState, useEffect } from "react";

const JoinRoom = () => {
    const [inputCode, setInputCode] = useState("");
    const [nickname, setNickname] = useState("");
    const navigate = useNavigate();

    useEffect(() => {
        const handleSocketError = (message: string) => alert(`Error: ${message}`);
        
        // --- NEW: Navigate only after the server acknowledges a valid room ---
        const handleJoinSuccess = (code: string) => {
            navigate(`/room/${code}`);
        };

        socket.on("error", handleSocketError);
        socket.on("join-success", handleJoinSuccess);

        return () => {
            socket.off("error", handleSocketError);
            socket.off("join-success", handleJoinSuccess);
        };
    }, [navigate]);

    const joinRoom = (event: React.FormEvent) => {
        event.preventDefault();
        const trimmedCode = inputCode.trim();
        const trimmedNickname = nickname.trim();

        if (!trimmedCode || !trimmedNickname) return;

        localStorage.setItem("roomCode", trimmedCode);
        localStorage.setItem("nickname", trimmedNickname);
        
        // Emit event to verify. Navigation handles itself asynchronously above now.
        socket.emit("join-room", { inputCode: trimmedCode, nickname: trimmedNickname });
    };

    const isInvalid = !inputCode.trim() || !nickname.trim();

    return (
        <div className="w-full flex flex-col items-center">
            <div className="mb-6 flex justify-center items-center gap-2">
                <img
                    src="/assets/icons/Guillotine_text.svg"
                    className="h-10 w-auto invert brightness-200"
                    alt="Guillotine logo"
                />
            </div>
            
            <h2 className="text-2xl font-black tracking-wide text-white text-center uppercase">Welcome to Guillotine!</h2>
            <p className="text-xs font-medium text-zinc-300 text-center mt-1 mb-6 tracking-normal">Enter a room code and nickname to join</p>
            
            <form className="w-full space-y-3" onSubmit={joinRoom}>
                <input 
                    type="text" 
                    id="roomCode"  
                    value={inputCode}
                    onChange={(e) => setInputCode(e.target.value)} 
                    className="w-full px-4 py-3 rounded-xl bg-black/40 text-white border border-white/20 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent placeholder-zinc-500 text-sm transition-all text-center font-medium" 
                    placeholder="Enter the room code"
                />
                <input 
                    type="text" 
                    id="nickname"  
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)} 
                    className="w-full px-4 py-3 rounded-xl bg-black/40 text-white border border-white/20 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent placeholder-zinc-500 text-sm transition-all text-center font-medium" 
                    placeholder="Enter your nickname"
                />
                <button 
                    type="submit" 
                    disabled={isInvalid}
                    className={`w-full py-3 mt-2 rounded-xl font-bold tracking-wider text-sm uppercase transition-all shadow-lg ${
                        isInvalid
                          ? "bg-zinc-800 text-zinc-500 cursor-not-allowed opacity-40"
                          : "bg-red-600 hover:bg-red-500 active:scale-[0.98] text-white cursor-pointer shadow-red-900/30"
                      }`}
                >
                    Join Room
                </button>
            </form>
            <p className="text-xs text-zinc-400 text-center mt-6">
                Don't have an active room? <Link to="/room/create" className="text-red-400 hover:text-red-300 font-semibold underline underline-offset-4 transition ml-1">Create Room</Link>
            </p>
        </div>
    );
};

export default JoinRoom;