import { useState, useEffect } from "react";
import socket from "../components/socket";
import { useParams, useLocation, useNavigate } from "react-router-dom";

// Matching your JSON color keys
const BALATRO_PALETTE: Record<string, string> = {
    violet: "bg-[#7d5ba6] border-[#5a3d7c]", 
    blue: "bg-[#4a90e2] border-[#2d5a8e]",   
    green: "bg-[#7db13c] border-[#567a29]",  
    red: "bg-[#e74c3c] border-[#962d22]",    
    gray: "bg-[#95a5a6] border-[#7f8c8d]",   
};

const actionCardConfig: Record<string, { requiresTarget?: boolean | "player" | "index" }> = {
  // --- Player-Targeted Cards ---
  a1:  { requiresTarget: "player" },  // After You...
  a22: { requiresTarget: "player" },  // Infighting
  a25: { requiresTarget: "player" },  // Lack of Support
  a42: { requiresTarget: "player" },  // Rush Job
  a47: { requiresTarget: "player" },  // Tough Crowd

  // --- Noble Index-Targeted Cards ---
  a5:  { requiresTarget: "index" },   // Civic Pride (Target a Green noble)
  a8:  { requiresTarget: "index" },   // Clothing Swap
  a13: { requiresTarget: "index" },   // Fainting Spell
  a14: { requiresTarget: "index" },   // Fled to England
  a19: { requiresTarget: "index" },   // Friend of the Queen
  a20: { requiresTarget: "index" },   // Ignoble Noble
  a28: { requiresTarget: "index" },   // L'Idiot
  a29: { requiresTarget: "index" },   // Majesty (Target a Purple noble)
  a31: { requiresTarget: "index" },   // Military Might (Target a Red noble)
  a38: { requiresTarget: "index" },   // Public Demand
  a39: { requiresTarget: "index" },   // Pushed
  a44: { requiresTarget: "index" },   // Stumble
  a46: { requiresTarget: "index" },   // 'Tis a Far Better Thing
  a48: { requiresTarget: "index" },   // Trip
  a50: { requiresTarget: "index" },   // Was That My Name?
};

function isNumberArray(arr: number[] | string[] | undefined): arr is number[] {
    return Array.isArray(arr) && arr.every(item => typeof item === "number");
}

const Game2 = () => {
    const [gameState, setGameState] = useState<any>(null);
    const [gameOverData, setGameOverData] = useState<any>(null); 
    const location = useLocation();
    const navigate = useNavigate();
    const { roomCode } = useParams<{ roomCode: string }>();
    const [focusCard, setFocusCard] = useState<any>(null);
    const [viewPlayer, setViewPlayer] = useState<any>(null);
    const [selectedAction, setSelectedAction] = useState<null | { card: any, validTargets: number[] | string[] }>(null);

    const nickname = location.state?.nickname || localStorage.getItem("nickname");

    // Gather context on where the focused card sits in our hand to back pagination
    const me = gameState?.players?.find((p: any) => p.nickname === nickname);
    const activePlayer = gameState?.players?.[gameState?.turnIndex];
    const isMyTurn = activePlayer?.nickname === nickname;
    const handCards = me?.hand || [];
    const focusedHandIndex = focusCard ? handCards.findIndex((c: any) => c.instanceId === focusCard.instanceId) : -1;

    // Handle Keyboard Navigation within modal focusing
    useEffect(() => {
        if (!focusCard || focusedHandIndex === -1) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "ArrowRight" && focusedHandIndex < handCards.length - 1) {
                setFocusCard(handCards[focusedHandIndex + 1]);
            } else if (e.key === "ArrowLeft" && focusedHandIndex > 0) {
                setFocusCard(handCards[focusedHandIndex - 1]);
            } else if (e.key === "Escape") {
                setFocusCard(null);
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [focusCard, focusedHandIndex, handCards]);

    useEffect(() => {
        if (!roomCode || !nickname) return;

        const handleUpdate = (data: any) => {
            setGameState(data);
        };

        const handleGameOver = (data: { players: any[] }) => {
            const ranked = [...data.players].sort((a, b) => b.score - a.score);
            setGameOverData({ players: ranked });
        };

        socket.on("game-state-update", handleUpdate);
        socket.on("game-over", handleGameOver);

        const handleConnect = () => {
            socket.emit("request-game-state", {
                roomCode: roomCode.toUpperCase(),
                nickname
            });
        };

        socket.on("connect", handleConnect);
        if (socket.connected) handleConnect();

        return () => {
            socket.off("game-state-update", handleUpdate);
            socket.off("game-over", handleGameOver);
            socket.off("connect", handleConnect);
        };
    }, [roomCode, nickname]);

    if (gameOverData) {
        return (
            <div className="min-h-screen w-screen bg-[#121212] text-white font-mono flex flex-col items-center justify-center p-6 overflow-y-auto select-none">
                <div className="max-w-4xl w-full bg-zinc-950 border-4 border-red-600 rounded-2xl p-8 shadow-[0_0_50px_rgba(231,76,60,0.3)] flex flex-col items-center gap-6 animate-fade-in my-8">
                    <div className="text-center">
                        <h1 className="text-5xl font-black italic text-red-500 tracking-tighter uppercase">Execution Finished</h1>
                        <p className="text-xs tracking-widest text-zinc-500 font-bold uppercase mt-1">Final Match Statistics • Room {roomCode?.toUpperCase()}</p>
                    </div>
                    <hr className="w-full border-zinc-800" />
                    <div className="w-full flex flex-col gap-4">
                        {gameOverData.players.map((p: any, idx: number) => {
                            const playerGrouped = p.collection?.reduce((acc: any, head: any) => {
                                const color = head.color || "gray";
                                if (!acc[color]) acc[color] = 0;
                                acc[color]++;
                                return acc;
                            }, {});
                            return (
                                <div key={p.nickname} className={`flex flex-col md:flex-row items-center justify-between p-5 rounded-xl border-2 backdrop-blur-sm ${idx === 0 ? "bg-amber-950/30 border-yellow-500 shadow-[0_0_20px_rgba(234,179,8,0.15)]" : "bg-zinc-900/60 border-zinc-800"}`}>
                                    <div className="flex items-center gap-4 mb-3 md:mb-0">
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-lg ${idx === 0 ? "bg-yellow-500 text-black animate-pulse" : "bg-zinc-800 text-zinc-400"}`}>{idx + 1}</div>
                                        <div>
                                            <h3 className="text-xl font-extrabold flex items-center gap-2">{p.nickname}{idx === 0 && <span>👑</span>}{p.nickname === nickname && <span className="text-xs bg-zinc-800 border border-zinc-700 px-2 py-0.5 rounded text-gray-400 font-normal">YOU</span>}</h3>
                                            <p className="text-[11px] text-zinc-500 uppercase font-bold mt-0.5">Cards Left in Hand: {p.hand?.length || 0}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 mb-3 md:mb-0 bg-black/40 border border-zinc-800/80 px-4 py-2 rounded-lg">
                                        {Object.keys(BALATRO_PALETTE).map((color) => (
                                            <div key={color} className="flex flex-col items-center px-1.5">
                                                <div className={`w-3 h-3 rounded-full ${BALATRO_PALETTE[color].split(" ")[0]} opacity-80`} />
                                                <span className="text-[10px] font-black mt-1 text-zinc-400">{playerGrouped?.[color] || 0}</span>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="text-right flex flex-col justify-center items-center md:items-end">
                                        <span className="text-xs text-zinc-500 font-bold uppercase tracking-wider">Total Score</span>
                                        <span className={`text-3xl font-black italic ${idx === 0 ? "text-yellow-500" : "text-red-400"}`}>{p.score} <span className="text-xs font-normal not-italic text-zinc-400">pts</span></span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    <hr className="w-full border-zinc-800 mt-2" />
                    <button onClick={() => navigate("/")} className="w-full md:w-auto bg-red-600 hover:bg-red-500 text-white font-black px-8 py-3 rounded-xl shadow-lg uppercase tracking-wider text-sm border-2 border-red-500">Return to Main Menu</button>
                </div>
            </div>
        );
    }

    if (!gameState) {
        return (
            <div className="text-white text-center mt-20">
                <p className="animate-pulse">Waiting for executioner...</p>
                <p className="text-xs text-gray-500 mt-2">Room: {roomCode} | User: {nickname}</p>
            </div>
        );
    }

    const initialCollection: Record<string, any[]> = {};

    const groupedCollection = (me?.collection || []).reduce((acc: Record<string, any[]>, head: any) => {
        const color = head.color || 'gray';
        if (!acc[color]) acc[color] = [];
        acc[color].push(head);
        return acc;
    }, { ...initialCollection });

    const viewedCollection = (viewPlayer?.collection || []).reduce((acc: Record<string, any[]>, head: any) => {
        const color = head.color || "gray";
        if (!acc[color]) acc[color] = [];
        acc[color].push(head);
        return acc;
    }, { ...initialCollection });

    const handleExecute = () => {
        if (!isMyTurn) return;
        socket.emit("execute-noble", { roomCode });
    };

    const handleSelectActionCard = (card: any) => {
        const config = actionCardConfig[card.key];
        if (!config?.requiresTarget) {
            socket.emit("play-action-card", {
                roomCode,
                instanceId: card.instanceId
            });
            return;
        }

        let validTargets: number[] | string[] = [];
        if (config.requiresTarget === "index") {
            validTargets = gameState.lineUp.map((_:any, i:any) => i);
        } else if (config.requiresTarget === "player") {
            validTargets = gameState.players
                .filter((p: any) => p.nickname !== me.nickname)
                .map((p: any) => p.nickname);
        }
        setSelectedAction({ card, validTargets });
    };

    return (
        <div className="h-screen w-screen bg-[#1f1f1f] text-white font-mono flex flex-col overflow-hidden select-none">
            
            {/* Top Bar: Scoreboard */}
            <div className="flex justify-between items-start mb-4 mt-5 ml-5 mr-5 z-20">
                <div className="bg-black border-2 border-red-500 p-4 rounded-lg shadow-[0_0_15px_rgba(239,68,68,0.4)] flex flex-col justify-center">
                    <p className="text-xs uppercase text-gray-400 font-bold tracking-wider">Your Score</p>
                    <p className="text-4xl font-extrabold text-red-500 italic">{me?.score || 0}</p>
                    {isMyTurn && (
                        <div className="text-[10px] bg-emerald-950 text-emerald-400 border border-emerald-700 px-1.5 py-0.5 rounded font-black mt-1 uppercase tracking-tighter animate-pulse text-center">
                            {me?.actions || 0} Actions Left
                        </div>
                    )}
                </div>
                
                <div className="flex flex-col gap-2">
                    {gameState.players.map((p: any) => (
                    p.nickname !== nickname && (
                        <div
                            key={p.nickname}
                            className={`cursor-pointer relative p-3 rounded-xl border flex flex-col w-52 transition-all hover:scale-[1.03] ${
                                p.connected ? "bg-zinc-900 border-zinc-700 hover:border-zinc-500" : "bg-zinc-800 border-red-500 opacity-60 animate-pulse"
                            } ${
                                selectedAction && (selectedAction.validTargets as any[]).includes(p.nickname) 
                                    ? "border-blue-500 bg-blue-950/40 shadow-[0_0_15px_rgba(59,130,246,0.3)] animate-pulse" 
                                    : ""
                            }`}
                            onClick={() => {
                                if (selectedAction && (selectedAction.validTargets as any[]).includes(p.nickname)) {
                                    socket.emit("play-action-card", { roomCode, instanceId: selectedAction.card.instanceId, target: p.nickname });
                                    setSelectedAction(null);
                                } else {
                                    setViewPlayer(p);
                                }
                            }}
                        >
                            <div className="flex justify-between items-center w-full">
                                <span className={`font-bold ${!p.connected ? "line-through text-gray-500" : ""}`}>{p.nickname}</span>
                                <span className="font-black text-red-400">{p.score} pts</span>
                            </div>
                            {p.tableau && p.tableau.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-2">
                                    {p.tableau.map((t: any) => (
                                        <span key={t.instanceId} className="text-[9px] bg-amber-950 text-amber-400 px-1 py-0.5 rounded border border-amber-800 font-bold uppercase truncate max-w-full">📜 {t.name}</span>
                                    ))}
                                </div>
                            )}
                        </div>
                    )
                ))}
                    <div className="mt-1 text-center bg-yellow-400 text-black font-black text-xs py-1 rounded shadow-md">DAY {gameState.day} / 3</div>
                </div>
            </div>

            {/* Informative Target Mode Banner */}
            {selectedAction && (
                <div className="bg-blue-950 border border-blue-500/50 text-center py-2.5 mx-5 rounded-xl text-xs font-bold text-blue-200 flex justify-center items-center gap-3 shadow-lg z-40 animate-pulse">
                    <span>⚡ Playing <strong className="text-white font-extrabold underline">{selectedAction.card.name}</strong>: {selectedAction.validTargets.every(t => typeof t === "string") ? " Click on a targeted opponent badge above" : " Select a highlighted noble in the execution line"}</span>
                    <button onClick={() => setSelectedAction(null)} className="bg-zinc-800 hover:bg-zinc-700 text-gray-300 border border-zinc-600 px-2 py-0.5 rounded font-black text-[10px] uppercase">Cancel</button>
                </div>
            )}

            {/* Main Line Up Grid Area */}
            <div className="relative flex-1 flex flex-col justify-center items-center w-full min-h-[250px]">
                <div className="absolute left-10 top-1/2 -translate-y-1/2 -rotate-90 origin-left hidden lg:block select-none pointer-events-none">
                    <div className="text-8xl font-black text-gray-400 tracking-tighter opacity-[0.03] uppercase">Guillotine</div>
                </div>

                <div className="flex items-center justify-center w-full max-w-7xl px-4">
                    <div className="flex items-center justify-center -space-x-14 sm:-space-x-12 md:space-x-2 lg:space-x-4 transition-all duration-500">
                        {gameState.lineUp.map((head: any, i: number) => {
                            const isTargetable = isNumberArray(selectedAction?.validTargets) && selectedAction.validTargets.includes(i);
                            return (
                                <div
                                    key={head.instanceId}
                                    onClick={() => {
                                        if (!isMyTurn) { setFocusCard(head); return; }
                                        if (selectedAction && selectedAction.card) {
                                            if (isTargetable) {
                                                socket.emit("play-action-card", { roomCode, instanceId: selectedAction.card.instanceId, target: i });
                                                setSelectedAction(null);
                                            }
                                        } else if (i === 0) {
                                            handleExecute();
                                        } else {
                                            setFocusCard(head);
                                        }
                                    }}
                                    className={`relative flex-shrink-0 w-24 h-36 sm:w-32 sm:h-44 rounded-xl cursor-pointer transition-all duration-300 ease-out hover:mx-10 sm:hover:mx-12 md:hover:mx-2 hover:-translate-y-8 hover:z-50 hover:scale-110 ${isTargetable ? 'border-4 border-blue-500 shadow-[0_0_30px_rgba(59,130,246,0.8)] scale-105 z-50 animate-pulse' : ''} ${i === 0 && isMyTurn && !selectedAction ? 'z-40 border-4 border-yellow-400 shadow-[0_0_40px_rgba(250,204,21,0.6)] scale-105' : 'z-10 shadow-xl'}`}
                                    style={{ transform: i === 0 && isMyTurn ? 'none' : `rotate(${(i % 2 === 0 ? 1 : -1) * 2}deg)` }}
                                >
                                    {i === 0 && (
                                        <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-yellow-400 text-black px-3 py-0.5 text-[9px] font-black rounded-full animate-bounce z-50 shadow-md uppercase tracking-wider">CHOP</div>
                                    )}
                                    <img src={`/assets/cards/images/${head.key}.jpeg`} alt={head.name} className="w-full h-full object-cover rounded-xl border border-white/10 brightness-110" onError={(e) => { e.currentTarget.src = "/assets/cards/card-back.png"; }} />
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* ADDED: Global Match Action Activity Log Notification Feed Marquee */}
                {gameState.lastAction && (
                    <div className="mt-6 bg-zinc-950/80 border border-zinc-800 rounded-full px-6 py-2 shadow-2xl flex items-center gap-3 animate-fade-in max-w-xl mx-auto backdrop-blur-sm">
                        <span className="flex h-2 w-2 rounded-full bg-red-500 animate-ping" />
                        <p className="text-xs tracking-wide text-zinc-300 font-medium">
                            <span className="text-zinc-500 uppercase font-bold mr-1.5">Latest:</span> 
                            {gameState.lastAction}
                        </p>
                    </div>
                )}
            </div>

            {/* Bottom Shelf Section */}
            <div className="w-full pt-14 p-6 pb-4 flex flex-col md:flex-row justify-between items-stretch bg-gradient-to-t from-black/95 via-black/60 to-transparent gap-4 z-10">
                
                {/* Scored Collection Stack */}
                <div className="flex flex-col gap-3 max-w-full justify-end">
                    <div className="flex items-center gap-4">
                        <p className="text-xs uppercase font-bold text-gray-500 tracking-wider">Your Collected Pile</p>
                        {me?.tableau && me.tableau.length > 0 && (
                            <div className="flex gap-1">
                                {me.tableau.map((t: any) => (
                                    <span key={t.instanceId} className="text-[9px] bg-amber-900/40 text-amber-300 border border-amber-700/60 font-black rounded px-2 py-0.5 uppercase">📜 {t.name}</span>
                                ))}
                            </div>
                        )}
                    </div>
                    <div className="flex gap-6 items-end overflow-x-auto pb-2 max-w-full scrollbar-hide">
                        {groupedCollection && Object.keys(groupedCollection).length === 0 && (
                            <p className="text-xs text-zinc-600 italic">No heads scored yet...</p>
                        )}
                        {groupedCollection && Object.entries(groupedCollection).map(([color, heads]: [string, any]) => (
                            <div key={color} className="relative group flex flex-col items-center">
                                <div className="flex -space-x-16 group-hover:-space-x-4 transition-all duration-500 ease-out h-32 items-end">
                                    {heads.map((head: any, i: number) => (
                                        <img 
                                            key={head.instanceId}
                                            src={`/assets/cards/images/${head.key}.jpeg`} 
                                            onClick={() => setFocusCard(head)}
                                            className={`w-20 h-28 rounded-lg border border-white/20 shadow-2xl brightness-110 transform transition-all duration-300 hover:-translate-y-8 hover:z-50 ${BALATRO_PALETTE[color] || 'bg-zinc-800'}`}
                                            style={{ transform: `rotate(${(i % 2 === 0 ? 1 : -1) * (i * 2)}deg)`, zIndex: i }}
                                            onError={(e) => { e.currentTarget.src = "/assets/cards/card-back.png"; }}
                                        />
                                    ))}
                                </div>
                                <span className="mt-1.5 text-[10px] font-black uppercase text-gray-500 tracking-wide">{color} ({heads.length})</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Hand View Drawer */}
                <div className="flex flex-col items-end gap-2 max-w-full md:max-w-[60%] justify-end relative z-30">
                    <div className="flex justify-between items-center w-full px-1">
                        {isMyTurn && <div className="bg-red-600 px-3 py-1 text-sm font-black italic skew-x-[-12deg] text-white shadow-md animate-pulse">YOUR TURN</div>}
                        <p className="text-xs uppercase font-bold text-gray-500 tracking-wider ml-auto">Your Hand ({handCards.length})</p>
                    </div>
                    <div className="flex -space-x-10 hover:-space-x-2 transition-all duration-500 pt-16 pb-4 px-4 overflow-x-visible overflow-y-visible h-48 items-end">
                        {handCards.map((card: any) => (
                            <div key={card.instanceId} className="relative group cursor-pointer flex-shrink-0 transition-all duration-300 hover:-translate-y-14 hover:scale-125 z-10 hover:z-50">
                                <img src={`/assets/cards/images/${card.key}.jpeg`} onClick={() => setFocusCard(card)} className="w-24 h-36 rounded-xl border-2 border-white/10 shadow-2xl" onError={(e) => { e.currentTarget.src = "/assets/cards/card-back.png"; }} />
                                {isMyTurn && me.actions > 0 && !selectedAction && (
                                    <button onClick={(e) => { e.stopPropagation(); handleSelectActionCard(card); }} className="absolute -top-10 left-1/2 -translate-x-1/2 bg-blue-600 hover:bg-blue-500 font-black text-white text-[10px] px-3 py-1.5 rounded-md shadow-2xl opacity-0 group-hover:opacity-100 transition-all uppercase tracking-wider z-[100] border border-blue-400 whitespace-nowrap">PLAY CARD</button>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Full Detailed Focus Carousel Modal */}
            {focusCard && (
                <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[150] flex flex-col items-center justify-center p-4 select-none" onClick={() => setFocusCard(null)}>
                    {focusedHandIndex !== -1 && (
                        <div className="mb-4 text-xs font-bold uppercase tracking-widest text-zinc-500">
                            Card {focusedHandIndex + 1} of {handCards.length} • Use <span className="text-zinc-300">← / → Keys</span> to browse
                        </div>
                    )}

                    <div className="flex items-center justify-center w-full max-w-3xl gap-6">
                        {focusedHandIndex > 0 ? (
                            <button 
                                onClick={(e) => { e.stopPropagation(); setFocusCard(handCards[focusedHandIndex - 1]); }}
                                className="bg-zinc-900/80 hover:bg-zinc-800 text-white w-14 h-14 rounded-full border border-zinc-700/60 flex items-center justify-center font-black text-xl hover:scale-110 active:scale-95 transition-all shadow-2xl"
                            >
                                ◀
                            </button>
                        ) : <div className="w-14" />}

                        <div className="relative group/modal flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
                            <img 
                                src={`/assets/cards/images/${focusCard.key}.jpeg`} 
                                alt={focusCard.name}
                                className="max-h-[70vh] aspect-[5/7] object-contain rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.8)] border border-white/10 brightness-110 transition-transform"
                                onError={(e) => { e.currentTarget.src = "/assets/cards/card-back.png"; }}
                            />

                            {focusedHandIndex !== -1 && isMyTurn && me.actions > 0 && !selectedAction && (
                                <button 
                                    onClick={() => {
                                        handleSelectActionCard(focusCard);
                                        setFocusCard(null); 
                                    }}
                                    className="mt-6 bg-emerald-600 hover:bg-emerald-500 text-white font-black px-10 py-3 rounded-xl shadow-2xl tracking-widest uppercase text-xs border border-emerald-400 hover:scale-105 active:scale-95 transition-all"
                                >
                                 Play This Card
                                </button>
                            )}
                        </div>

                        {focusedHandIndex !== -1 && focusedHandIndex < handCards.length - 1 ? (
                            <button 
                                onClick={(e) => { e.stopPropagation(); setFocusCard(handCards[focusedHandIndex + 1]); }}
                                className="bg-zinc-900/80 hover:bg-zinc-800 text-white w-14 h-14 rounded-full border border-zinc-700/60 flex items-center justify-center font-black text-xl hover:scale-110 active:scale-95 transition-all shadow-2xl"
                            >
                                ▶
                            </button>
                        ) : <div className="w-14" />}
                    </div>

                    <div className="mt-6 text-zinc-600 text-[10px] tracking-widest uppercase font-bold">
                        [ Click outside or hit ESC to close window ]
                    </div>
                </div>
            )}

            {/* View Profile Overlay Model */}
            {viewPlayer && (
                <div className="fixed inset-0 bg-black/95 backdrop-blur-lg z-[120] flex flex-col items-center justify-center p-6" onClick={() => setViewPlayer(null)}>
                    <div className="text-3xl font-black mb-1 uppercase tracking-wider text-gray-200">{viewPlayer.nickname}'s Score Pile</div>
                    <div className="text-red-400 font-black text-sm mb-8 uppercase tracking-widest bg-red-950/40 border border-red-900/60 px-4 py-1 rounded-full">Current Tally: {viewPlayer.score} Points</div>
                    <div className="flex gap-10 flex-wrap justify-center max-w-6xl overflow-y-auto max-h-[60vh] p-4 scrollbar-hide">
                        {viewedCollection && Object.entries(viewedCollection).map(([color, heads]: [string, any]) => (
                            <div key={color} className="flex flex-col items-center">
                                <div className="flex -space-x-14">
                                    {heads.map((head: any, i: number) => (
                                        <img key={head.instanceId} src={`/assets/cards/images/${head.key}.jpeg`} className="w-24 h-36 rounded-xl border border-white/20 shadow-2xl" style={{ zIndex: i }} onError={(e) => { e.currentTarget.src = "/assets/cards/card-back.png"; }} />
                                    ))}
                                </div>
                                <span className="mt-3 text-xs font-black uppercase text-gray-400 bg-zinc-900 border border-zinc-800 px-3 py-1 rounded-md mt-2">{color} ({heads.length})</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default Game2;