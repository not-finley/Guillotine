import { useState } from "react";
import socket from "../../components/socket";
import { Link, useNavigate } from "react-router-dom"


const CreateRoom = () => {
    const [ nickname, setNickname ] = useState("");
    const navigate = useNavigate();

    const createRoom = (event: React.FormEvent) => {
        event.preventDefault();
        if (!nickname.trim()) {
            alert("Please enter a nickname.");
            return;
        }
        localStorage.setItem("nickname", nickname);

        socket.emit("create-room", {nickname});
        socket.on("room-created", (code) => {
            localStorage.setItem("roomCode", code);
            navigate(`/room/${code}`);
        });
    };

  return (
    <>  
        <img
            src="/assets/icons/Guillotine_text.svg"
            className="invert-100 mb-6"
            
        />
        <h2 className="text-2xl font-bold text-white text-center">Welcome to Guillotine!</h2>
        <h2 className="text-md font-regular text-gray-300 text-center mb-6">Enter your nickname to create a room</h2>
        <form className="space-y-4 text-left" onSubmit={createRoom}>
            <div>
                <input 
                    type="text" 
                    id="nickname" 
                    onChange={(e) => setNickname(e.target.value)}
                    className="w-full p-3 rounded-lg bg-white/20 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 placeholder-gray-300" 
                    placeholder="Enter your nickname"/>
            </div>
            <button 
                type="submit" 
                className={`w-full text-white p-3 rounded-lg font-semibold transition ${
                    nickname.length == 0
                      ? "bg-gray-600 text-gray-400 cursor-not-allowed"
                      : "bg-cyan-600 hover:bg-cyan-700 cursor-pointer"
                  }`}
            >
                Create
            </button>
        </form>
        <p className="text-small-regular text-light-2 text-center mt-2">
            Trying to join a game?  <Link to="/room/join">Join</Link>
        </p>
    </>
    )
}

export default CreateRoom