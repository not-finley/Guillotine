import { useNavigate, useParams } from "react-router-dom";
import socket from "../components/socket";
import { useEffect, useState, MouseEvent } from "react";

interface Player {
  id: string;
  nickname: string;
}


const Room = () => {
  const { roomCode } = useParams();
  const [players, setPlayers] = useState<Player[]>([]);
  const [copySuccess, setCopySuccess] = useState(false);
  const [popupPosition, setPopupPosition] = useState({x:0, y:0});

  const [nickname, setNickname] = useState<string>("");
  const [showModal, setShowModal] = useState<boolean>(true);

  const navigate = useNavigate();

  useEffect(() => {
    socket.on("update-players", (updatedPlayers) => {
      setPlayers(updatedPlayers); // Update UI
    });

    return () => {
      socket.off("update-players"); // Cleanup on unmount
    };
  }, [roomCode]);

  useEffect(() => {
  // Listen for the state update instead of just 'start-game'
    socket.on("game-state-update", (initialState) => {
      console.log("Game state received, transitioning...");
      // We pass the nickname in state as a backup to localStorage
      navigate(`/game/${roomCode}`, { state: { nickname } });
    });

    return () => {
      socket.off("game-state-update");
    };
  }, [navigate, roomCode, nickname]);

  useEffect(() => {
    const savedRoomCode = localStorage.getItem("roomCode");
    const savedNickname = localStorage.getItem("nickname");

    if (savedRoomCode && savedNickname && savedRoomCode == roomCode) {
      console.log(`Reconnecting to room: ${savedRoomCode}`);
      setShowModal(false);
      socket.emit("join-room", { inputCode: savedRoomCode, nickname: savedNickname });
    }
  }, [roomCode]);

  const handleJoin = () => {
  if (!nickname.trim()) return;
  const upperCode = roomCode ? roomCode.toUpperCase() : ""; 
  localStorage.setItem("nickname", nickname);
  localStorage.setItem("roomCode", upperCode);
  setShowModal(false);
  socket.emit("join-room", { inputCode: upperCode, nickname });
};

  const copyToClipboard = (event: MouseEvent<HTMLButtonElement>) => {
    if (roomCode) {
      navigator.clipboard.writeText(roomCode)
        .then(() => {
          setPopupPosition({ x: event.clientX, y: event.clientY });
          setCopySuccess(true);
          setTimeout(() => setCopySuccess(false), 800);
        })
        .catch(err => console.error("Failed to copy:", err));
    }
  };

  const startGame = () => {
    socket.emit("start-game", {roomCode: roomCode});
  }
 
  return (
    <div>
      {showModal && (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center">
          <form onSubmit={(e)=> {
            e.preventDefault(); 
            handleJoin()}}
          className="bg-gray-800 p-6 rounded-lg shadow-lg text-white">
            <h2 className="text-lg font-bold">Enter Your Nickname</h2>
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              className="p-2 mt-2 mr-3 rounded bg-gray-700 text-white border border-gray-500"
              placeholder="Your nickname"
            />
            <button
              type="submit"
              className="mt-3 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg"
            >
              Join Room
            </button>
          </form>
        </div>
      )}
      <div className="flex flex-col items-center space-y-6">
        {/* Status Message */}
        <div className="bg-gray-800 p-4 rounded-2xl shadow-lg text-center w-full max-w-md">
          {players.length <= 1 ? ( <p className="font-semibold text-white">At least 2 players are needed to start!</p>) : 
          (<h2 className="font-semibold text-white">Press Start when everyone's ready!</h2>)}
        </div>

        {/* Room Details & Player List */}
        <div className="bg-gray-800 p-6 rounded-2xl shadow-xl w-full max-w-md text-center">
          <h2 className="text-lg font-bold text-white">Room Code: <button id="room_code" className="text-blue-400 cursor-pointer hover:text-blue-300" onClick={copyToClipboard}>{roomCode}</button></h2>
          <h3 className="text-md text-gray-300">Players: {players.length}/5</h3>

          {/* Player List */}
          <ul className="mt-4 space-y-2">
            {players.map((player: Player) => (
              <li key={player.id} className={`p-2 rounded-lg shadow-md text-white ${ player.nickname == localStorage.getItem("nickname")? "bg-blue-500" : "bg-gray-700"}`}>
                {player.nickname}
              </li>
            ))}
          </ul>

          {/* Start Button */}
          <button
            className={`mt-4 p-2 w-full rounded-lg font-semibold transition ${
              players.length > 1 
                ? "bg-blue-700 hover:bg-blue-600 text-white shadow-lg cursor-pointer" 
                : "bg-gray-600 text-gray-400 cursor-not-allowed"
            }`}
            disabled={players.length <= 1}
            onClick={startGame}
          >
            Start
          </button>
          {copySuccess &&  
          (<div className="absolute bg-blue-500 text-white text-sm px-4 py-2 rounded-md shadow-lg"
          style={{ top: popupPosition.y + 10, left: popupPosition.x + 10 }}>
            Room code copied!
          </div>)}
        </div>
      </div>

    </div>
  )
}

export default Room