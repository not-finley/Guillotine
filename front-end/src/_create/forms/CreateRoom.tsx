import { useState, useEffect } from "react";
import socket from "../../components/socket";
import { Link, useNavigate } from "react-router-dom";

const CreateRoom = () => {
    const [nickname, setNickname] = useState("");
    const navigate = useNavigate();

    useEffect(() => {
        // Listen for room creation globally within this component's lifecycle
        const handleRoomCreated = (code: string) => {
            localStorage.setItem("roomCode", code);
            navigate(`/room/${code}`);
        };

        socket.on("room-created", handleRoomCreated);

        // Clean up listener on unmount to prevent memory leaks
        return () => {
            socket.off("room-created", handleRoomCreated);
        };
    }, [navigate]);

    const createRoom = (event: React.FormEvent) => {
        event.preventDefault();
        const trimmedNickname = nickname.trim();
        
        if (!trimmedNickname) {
            alert("Please enter a nickname.");
            return;
        }
        
        localStorage.setItem("nickname", trimmedNickname);
        socket.emit("create-room", { nickname: trimmedNickname });
    };

    const isInvalid = !nickname.trim();

    return (
        <div className="w-full flex flex-col items-center">  
            {/* Logo Wrapper */}
            <div className="mb-6 flex justify-center items-center gap-2">
               <img
                    src="/assets/icons/Guillotine_text.svg"
                    className="h-10 w-auto max-w-full shrink-0 invert brightness-200 object-contain"
                    alt="Guillotine logo"
                />
            </div>

            <h2 className="text-2xl font-black tracking-wide text-white text-center uppercase">Welcome to Guillotine!</h2>
            <p className="text-xs font-medium text-zinc-300 text-center mt-1 mb-6 tracking-normal">Enter your nickname to create a room</p>
            
            <form className="w-full space-y-4" onSubmit={createRoom}>
                <div className="relative">
                    <input 
                        type="text" 
                        id="nickname" 
                        value={nickname}
                        onChange={(e) => setNickname(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl bg-black/40 text-white border border-white/20 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent placeholder-zinc-500 text-sm transition-all text-center font-medium" 
                        placeholder="Enter your nickname"
                    />
                </div>
                <button 
                    type="submit" 
                    disabled={isInvalid}
                    className={`w-full py-3 rounded-xl font-bold tracking-wider text-sm uppercase transition-all shadow-lg ${
                        isInvalid
                          ? "bg-zinc-800 text-zinc-500 cursor-not-allowed opacity-40"
                          : "bg-red-600 hover:bg-red-500 active:scale-[0.98] text-white cursor-pointer shadow-red-900/30"
                      }`}
                >
                    Create Room
                </button>
            </form>
            
            <p className="text-xs text-zinc-400 text-center mt-6">
                Trying to join an existing game? <Link to="/room/join" className="text-red-400 hover:text-red-300 font-semibold underline underline-offset-4 transition ml-1">Join Game</Link>
            </p>
        </div>
    );
};

export default CreateRoom;