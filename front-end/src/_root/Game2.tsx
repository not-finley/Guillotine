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
        <div className="h-screen w-screen bg-[#1f1f1f] text-white font-mono flex flex-col overflow-hidden">
            
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
            <div className="relative flex flex-col items-center w-full">
                {/* Background Title */}
                <div className="absolute left-0 top-1/2 -translate-y-1/2 -rotate-90 origin-left hidden lg:block">
                    <div className="text-6xl font-black text-gray-400 tracking-tighter opacity-10 uppercase select-none">
                        Guillotine
                    </div>
                </div>

                {/* The Container: Centered and Responsive */}
                <div className="flex items-center justify-center w-full max-w-7xl h-[300px] px-4">
                    
                    {/* The Card Wrapper: This uses negative spacing to bunch cards up */}
                    <div className="flex items-center justify-center -space-x-16 sm:-space-x-12 md:space-x-2 lg:space-x-4 transition-all duration-500">
                        {gameState.lineUp.map((head: any, i: number) => (
                            <div
                                key={head.instanceId}
                                onClick={() => i === 0 && isMyTurn ? handleExecute() : setFocusCard(head)}
                                className={`
                                     relative flex-shrink-0 w-28 h-40 sm:w-32 sm:h-48 rounded-xl cursor-pointer transition-all duration-300 ease-out
                                    
                                    /* Expansion Logic: When hovering a bunched card, push neighbors aside and pop up */
                                    hover:mx-10 sm:hover:mx-12 md:hover:mx-2 
                                    hover:-translate-y-8 hover:z-50 hover:scale-110
                                    
                                    /* Special Styling for the first card (The Target) */
                                    ${i === 0 && isMyTurn 
                                        ? 'z-40 border-4 border-yellow-400 shadow-[0_0_40px_rgba(250,204,21,0.6)] scale-105' 
                                        : 'z-10 shadow-xl'}
                                `}
                                style={{
                                    /* Slight rotation for that organic card-game feel */
                                    transform: i === 0 && isMyTurn ? 'none' : `rotate(${(i % 2 === 0 ? 1 : -1) * 2}deg)`,
                                }}
                            >
                                {/* Next Indicator for the first card */}
                                {i === 0 && (
                                    <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-yellow-400 text-black px-3 py-1 text-[10px] font-black rounded-full animate-bounce z-50 shadow-md">
                                        NEXT
                                    </div>
                                )}

                                <img 
                                    src={`/assets/cards/images/${head.key}.jpeg`} 
                                    alt={head.name}
                                    className="w-full h-full object-cover rounded-xl shadow-inner border border-white/10 brightness-110"
                                    onError={(e) => {
                                        e.currentTarget.src = "/assets/cards/card-back.png";
                                    }}
                                />
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Bottom Section: Hand & Status */}
            <div className="fixed bottom-0 left-0 w-full p-6 flex justify-between items-end bg-gradient-to-t from-black/80 to-transparent">
                {/* Your Collection (Score Pile) grouped by Color */}
                <div className="flex flex-col gap-2">
                    <p className="text-[14px] uppercase font-bold text-gray-500">Collection</p>
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
                                                  w-24 h-34 rounded-lg border border-white/20 shadow-2xl brightness-110
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
                                <span className="mt-2 text-[12px] uppercase font-black opacity-0 group-hover:opacity-100 transition-opacity text-gray-400">
                                    {color} ({heads.length})
                                </span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Game Information & Action Card Draw Pile */}
                <div className="flex flex-col items-end gap-4">
                    {isMyTurn && <div className="bg-red-600 px-4 py-2 text-xl font-black italic skew-x-[-12deg] shadow-lg animate-pulse">YOUR TURN</div>}
                    <div className="flex -space-x-12 hover:-space-x-2 transition-all duration-500">
        {me?.hand?.map((card: any) => (
            <div
                key={card.instanceId}
                className="relative group cursor-pointer"
                onClick={() => setFocusCard(card)} // Reuse your modal to see card details
            >
                <img 
                    src={`/assets/cards/images/${card.key}.jpeg`} 
                    className="w-24 h-36 rounded-xl border-2 border-white/20 shadow-2xl transition-transform hover:-translate-y-12 hover:scale-110"
                />
                
                {/* Play Button Overlay */}
                {isMyTurn && (
                    <button 
                        onClick={(e) => {
                            e.stopPropagation();
                            // Example: Send roomCode and the specific card
                            socket.emit("play-action-card", { 
                                roomCode, 
                                cardInstanceId: card.instanceId 
                            });
                        }}
                        className="absolute -top-4 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity font-bold"
                    >
                        PLAY
                    </button>
                )}
            </div>
        ))}
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
                        className="aspect-[5/7] object-cover rounded-xl shadow-lg brightness-110"
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