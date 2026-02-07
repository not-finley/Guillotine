import { useState, useEffect } from "react";
import socket from "../components/socket";
import { useParams, useLocation } from "react-router-dom";

// Matching your JSON color keys
const BALATRO_PALETTE: Record<string, string> = {
    violet: "bg-[#7d5ba6] border-[#5a3d7c]", 
    blue: "bg-[#4a90e2] border-[#2d5a8e]",   
    green: "bg-[#7db13c] border-[#567a29]",  
    red: "bg-[#e74c3c] border-[#962d22]",    
    gray: "bg-[#95a5a6] border-[#7f8c8d]",   
};

const Game2 = () => {
    const [gameState, setGameState] = useState<any>(null);
    const location = useLocation();
    const { roomCode } = useParams<{ roomCode: string }>();
    const [focusCard, setFocusCard] = useState<any>(null);

    const nickname = location.state?.nickname || localStorage.getItem("nickname");


    

    useEffect(() => {
        if (!roomCode || !nickname) return;

        const handleUpdate = (data: any) => {
            console.log("Received state:", data);
            setGameState(data);
        };

        socket.on("game-state-update", handleUpdate);

        // Send the actual values, not undefined!
        console.log(`Requesting state for ${roomCode} as ${nickname}`);
        socket.emit("request-game-state", { 
            roomCode: roomCode.toUpperCase(), 
            nickname 
        });

        return () => {
            socket.off("game-state-update", handleUpdate);
        };
    }, [roomCode, nickname]);

    if (!gameState) {
        return (
            <div className="text-white text-center mt-20">
                <p className="animate-pulse">Waiting for executioner...</p>
                <p className="text-xs text-gray-500 mt-2">Room: {roomCode} | User: {nickname}</p>
            </div>
        );
    }

    const me = gameState.players.find((p: any) => p.nickname === nickname);
    const isMyTurn = gameState.players[gameState.turnIndex]?.id === socket.id;


    const groupedCollection = me?.collection?.reduce((acc: any, head: any) => {
        const color = head.color || 'gray';
        if (!acc[color]) acc[color] = [];
        acc[color].push(head);
        return acc;
    }, {});

    const handleExecute = () => {
        if (!isMyTurn) return;
        socket.emit("execute-noble", { roomCode });
    };

    return (
        <div className="min-h-screen bg-[#1a1a1a] text-white font-mono p-4 md:p-8 overflow-hidden">
            
            {/* Top Bar: Opponents Scoreboard */}
            <div className="flex justify-between items-start mb-8">
                <div className="bg-black border-2 border-red-500 p-4 rounded-lg shadow-[0_0_15px_rgba(239,68,68,0.4)]">
                    <p className="text-xs uppercase text-gray-400">Your Score</p>
                    <p className="text-4xl font-bold text-red-500 italic">{me?.score || 0}</p>
                </div>
                
                <div className="flex flex-col gap-2">
                    {gameState.players.map((p: any) => (
                        p.id !== socket.id && (
                            <div key={p.id} className="bg-gray-800 p-2 rounded border border-gray-600 flex justify-between w-48">
                                <span>{p.nickname}</span>
                                <span className="font-bold text-red-400">{p.score}</span>
                            </div>
                        )
                    ))}
                    <div className="mt-2 text-center bg-yellow-400 text-black font-black text-xs py-1 rounded animate-bounce">
                        DAY {gameState.day} / 3
                    </div>
                </div>
            </div>

            {/* Main Game Area */}
            <div className="relative flex flex-col items-center">
                <div className="absolute left-0 top-1/2 -translate-y-1/2 -rotate-90 origin-left hidden md:block">
                    <div className="text-6xl font-black text-gray-700 tracking-tighter opacity-10 uppercase">Guillotine</div>
                </div>

                {/* The Line-Up */}
                <div className="flex gap-2 items-center justify-start w-full overflow-x-auto pb-12 pt-10 px-10 no-scrollbar">
                    {gameState.lineUp.map((head: any, i: number) => (
                        <div
                            key={head.instanceId}
                            onClick={() => i === 0 && isMyTurn ? handleExecute() : setFocusCard(head)}
                            className={`
                                relative flex-shrink-0 w-32 h-48 rounded-xl cursor-pointer transition-all duration-300
                                ${i === 0 && isMyTurn ? 'scale-110 border-4 border-yellow-400 z-20 shadow-[0_0_40px_rgba(250,204,21,0.6)]' : 'hover:-translate-y-4 z-10'}
                            `}
                        >
                            {/* Card Image */}
                            <img 
                                src={`/assets/cards/images/${head.key}.jpeg`} 
                                alt={head.name}
                                className="w-full h-full object-cover rounded-xl shadow-lg"
                                onError={(e) => {
                                    e.currentTarget.src = "/assets/cards/card-back.png";
                                }}
                            />
                            
                            {/* Overlay Value (Optional - if the value is already on your card art) */}
                            {/* <div className="absolute top-2 left-2 bg-black/50 px-2 rounded font-black text-xl">
                                {head.value}
                            </div> */}
                        </div>
                    ))}
                </div>
            </div>

            {/* Bottom Section: Hand & Status */}
            <div className="fixed bottom-0 left-0 w-full p-6 flex justify-between items-end bg-gradient-to-t from-black/80 to-transparent">
                {/* Your Collection (Score Pile) grouped by Color */}
                <div className="flex flex-col gap-2">
                    <p className="text-[10px] uppercase font-bold text-gray-500">Collection</p>
                    <div className="flex gap-6 items-end">
                        {groupedCollection && Object.entries(groupedCollection).map(([color, heads]: [string, any]) => (
                            <div key={color} className="relative group flex flex-col items-center">
                                {/* Stack Container */}
                                <div className="flex -space-x-16 group-hover:-space-x-4 transition-all duration-500 ease-out">
                                    {heads.map((head: any, i: number) => (
                                        <img 
                                            key={head.instanceId}
                                            src={`/assets/cards/images/${head.key}.jpeg`} 
                                            onClick={() => setFocusCard(head)}
                                            className={`
                                                w-20 h-28 rounded-lg border border-white/20 shadow-2xl 
                                                transform transition-all duration-300
                                                hover:-translate-y-8 hover:z-50
                                                ${BALATRO_PALETTE[color]}
                                            `}
                                            style={{
                                                // Slight rotation for a "messy stack" look
                                                transform: `rotate(${(i % 2 === 0 ? 1 : -1) * (i * 2)}deg)`,
                                                zIndex: i
                                            }}
                                        />
                                    ))}
                                </div>
                                {/* Color Label */}
                                <span className="mt-2 text-[8px] uppercase font-black opacity-0 group-hover:opacity-100 transition-opacity text-gray-400">
                                    {color} ({heads.length})
                                </span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Game Information & Action Card Draw Pile */}
                <div className="flex flex-col items-end gap-4">
                    {isMyTurn && <div className="bg-red-600 px-4 py-2 text-xl font-black italic skew-x-[-12deg] shadow-lg animate-pulse">YOUR TURN</div>}
                    <div className="flex gap-4">
                        <div className="w-24 h-36 bg-blue-900 rounded-xl border-2 border-blue-400 flex flex-col items-center justify-center shadow-[6px_6px_0px_#1e3a8a] relative overflow-hidden group">
                            <div className="absolute inset-0 bg-white/5 group-hover:bg-white/10 transition-colors"></div>
                            <span className="rotate-90 font-black text-blue-400 text-xs tracking-widest">ACTIONS</span>
                            <span className="mt-2 text-[10px] text-blue-300">{gameState.actionDeckCount || '??'}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Detailed View Modal */}
            {focusCard && (
                <div 
                    className="fixed inset-0 bg-black/90 backdrop-blur-md z-[100] flex items-center justify-center p-6"
                    onClick={() => setFocusCard(null)}
                >
                    <img 
                        src={`/assets/cards/images/${focusCard.key}.jpeg`} 
                        alt={focusCard.name}
                        className="asspect-[4/5] object-cover rounded-xl shadow-lg"
                        onError={(e) => {
                            e.currentTarget.src = "/assets/cards/card-back.png";
                        }}
                    />
                </div>
            )}
        </div>
    );
};

export default Game2;