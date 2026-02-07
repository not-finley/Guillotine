import { Link, useNavigate } from "react-router-dom"
import socket from "../../components/socket";
import { useState } from "react";

const JoinRoom = () => {
    const [inputCode, setInputCode] = useState("");
    const [ nickname, setNickname ] = useState("");
    const navigate = useNavigate();

    const joinRoom = (event: React.FormEvent) => {
        event.preventDefault();
        if (!nickname.trim() || !inputCode.trim()) {
            alert("Please enter both a room code and a nickname.");
            return;
        }

        localStorage.setItem("roomCode", inputCode);
        localStorage.setItem("nickname", nickname);

        socket.emit("join-room", {inputCode, nickname});

        socket.on("error", (message) => {
            console.log(message);
            return
        });

        navigate(`/room/${inputCode}`);
    };
  return (
    <>
        <img
            src="/assets/icons/Guillotine_text.svg"
            className="invert-100 mb-6"
            
        />
        
        <h2 className="text-2xl font-bold text-white text-center">Welcome to Guillotine!</h2>
        <h2 className="text-md font-regular text-gray-200 text-center mb-6">Enter a room code and nickname to join</h2>
        <form className="space-y-4 text-left" onSubmit={joinRoom}>
            <div>
                <input type="text" id="roomCode"  onChange={(e) => setInputCode(e.target.value)} className="w-full p-3 rounded-lg bg-white/20 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 placeholder-gray-300" placeholder="Enter the room code"/>
            </div>
            <div>
                <input type="text" id="nickname"  onChange={(e) => setNickname(e.target.value)} className="w-full p-3 rounded-lg bg-white/20 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 placeholder-gray-300" placeholder="Enter your nickname"/>
            </div>
            <button 
                type="submit" 
                className={`w-full text-white p-3 rounded-lg font-semibold transition ${
                    inputCode.length == 0 || nickname.length == 0
                      ? "bg-gray-600 text-gray-400 cursor-not-allowed"
                      : "bg-cyan-600 hover:bg-cyan-700 cursor-pointer"
                  }`}
            >
                Join
            </button>
        </form>
        <p className="text-small-regular text-light-2 text-center mt-2">
            Don't have an active room?  <Link to="/room/create">Create</Link>
        </p>
    </>
  )
}

export default JoinRoom