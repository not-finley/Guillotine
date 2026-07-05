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

const actionCardConfig: Record<string, { requiresTarget?: boolean | "player" | "index" | "tableau" | "complex" | "upTo", maxDistance?: number, direction?: "forward" | "backward"}> = {
  // --- Player-Targeted Cards ---
  a1:  { requiresTarget: "player" },  // After You...
  a9:  { requiresTarget: "player" },  // Confusion in Line
  a15: { requiresTarget: "player" },  // Forced Break (Even if global, lets them pick/view details or confirm action)
  a22: { requiresTarget: "player" },  // Infighting
  a23: { requiresTarget: "player" },  // Information Exchange
  a34: { requiresTarget: "player" },  // Missed!
  a35: { requiresTarget: "player" },  // Missing Heads
  a42: { requiresTarget: "player" },  // Rush Job
  a47: { requiresTarget: "player" },  // Tough Crowd

  // --- Noble Index-Targeted Cards ---
  a5:  { requiresTarget: "upTo", maxDistance: 2, direction: "forward" },   // Civic Pride
  a13: { requiresTarget: "upTo", maxDistance: 3, direction: "backward" },  // Fainting Spell
  a19: { requiresTarget: "upTo", maxDistance: 2, direction: "backward" },  // Friend of the Queen
  a28: { requiresTarget: "upTo", maxDistance: 2, direction: "forward" },   // L'Idiot
  a29: { requiresTarget: "upTo", maxDistance: 2, direction: "forward" },   // Majesty
  a31: { requiresTarget: "upTo", maxDistance: 2, direction: "forward" },   // Military Might
  a50: { requiresTarget: "upTo", maxDistance: 3, direction: "forward" },   // Was That My Name?
  a8:  { requiresTarget: "index" },   // Clothing Swap
  a14: { requiresTarget: "index" },   // Fled to England
  a20: { requiresTarget: "index" },   // Ignoble Noble
  a38: { requiresTarget: "index" },   // Public Demand
  a39: { requiresTarget: "index" },   // Pushed
  a44: { requiresTarget: "index" },   // Stumble
  a46: { requiresTarget: "index" },   // 'Tis a Far Better Thing
  a48: { requiresTarget: "index" },   // Trip

  // --- Specialized Complex Targeting (Tableau / Multi-field choices) ---
  a7:  { requiresTarget: "complex" }, // Clerical Error (Needs Target Player + specific card index)
  a25: { requiresTarget: "complex" }, // Lack of Support (View hand card choices)
  a26: { requiresTarget: "complex" }, // Late Arrival (Choose index 0-2 from upcoming pile choices)
  a36: { requiresTarget: "complex" }, // Opinionated Guards (Permutation Map input array)
  a41: { requiresTarget: "complex" }, // Rat Break (Choose target card from discard array)
  a49: { requiresTarget: "complex" }, // Twist of Fate (Target player's specific Tableau attachment instanceId)
};


const Game2 = () => {
    const [gameState, setGameState] = useState<any>(null);
    const [gameOverData, setGameOverData] = useState<any>(null); 
    const location = useLocation();
    const navigate = useNavigate();
    const { roomCode } = useParams<{ roomCode: string }>();
    const [focusCard, setFocusCard] = useState<any>(null);
    const [viewPlayer, setViewPlayer] = useState<any>(null);
    const [selectedAction, setSelectedAction] = useState<null | { card: any, validTargets: (number | string)[] }>(null);
    const [pendingUpToSelection, setPendingUpToSelection] = useState<null | { index: number, max: number, direction: "forward" | "backward" }>(null);
    const [isLogExpanded, setIsLogExpanded] = useState(false);


    const nickname = location.state?.nickname || localStorage.getItem("nickname");

    // Gather context on where the focused card sits in our hand to back pagination
    const me = gameState?.players?.find((p: any) => p.nickname === nickname);
    const activePlayer = gameState?.players?.[gameState?.turnIndex];
    const isMyTurn = activePlayer?.nickname === nickname;
    const handCards = me?.hand || [];
    const focusedHandIndex = focusCard ? handCards.findIndex((c: any) => c.instanceId === focusCard.instanceId) : -1;

    const logs: string[] = gameState?.actionLog || [];
    const latestAction = logs[0] || null;

    useEffect(() => {
        const handleRoomError = (errorMessage: string) => {
            alert(errorMessage); // Alert the user why they are being booted
            
            // Clean up stale credentials so they don't get trapped in a redirect loop
            localStorage.removeItem("roomCode");
            localStorage.removeItem("nickname");
            
            navigate("/"); // Send them back to the landing screen
        };

        socket.on("error", handleRoomError);

        return () => {
            socket.off("error", handleRoomError);
        };
    }, [navigate]);

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
            console.log(data)
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
            socket.emit("play-action-card", { roomCode, instanceId: card.instanceId });
            return;
        }

        let validTargets: number[] | string[] = [];
        if (config.requiresTarget === "index" || config.requiresTarget === "upTo") {
            validTargets = gameState.lineUp.map((_: any, i: any) => i);
        } else if (config.requiresTarget === "player") {
            validTargets = gameState.players
                .filter((p: any) => p.nickname !== me.nickname)
                .map((p: any) => p.nickname);
        }
        setSelectedAction({ card, validTargets });
    };

    return (
        <div className="min-h-screen md:h-screen w-screen bg-[#1f1f1f] text-white font-mono flex flex-col md:overflow-hidden select-none">
            
            {/* Top Bar: Scoreboard & Opponent List */}
            <div className="flex flex-col lg:flex-row lg:justify-between lg:items-start gap-4 mb-4 mt-5 px-4 md:px-5 z-20">
                
                {/* Self Score & Turn Info */}
                <div className="flex items-center justify-between lg:flex-col lg:justify-center bg-black border-2 border-red-500 p-3 md:p-4 rounded-xl shadow-[0_0_15px_rgba(239,68,68,0.4)]">
                    <div>
                        <p className="text-[10px] md:text-xs uppercase text-gray-400 font-bold tracking-wider">Your Score</p>
                        <p className="text-3xl md:text-4xl font-extrabold text-red-500 italic leading-none mt-1">{me?.score || 0}</p>
                    </div>
                    {isMyTurn && (
                        <div className="text-[9px] md:text-[10px] bg-emerald-950 text-emerald-400 border border-emerald-700 px-2 py-1 rounded font-black uppercase tracking-tighter animate-pulse text-center lg:mt-2">
                            {me?.actions || 0} Actions Left
                        </div>
                    )}
                </div>
                
                {/* Opponent list + Day tracker */}
                <div className="flex flex-col gap-2 w-full lg:w-auto">
                    <div className="flex flex-row lg:flex-col gap-2 overflow-x-auto pb-1 lg:pb-0 scrollbar-hide max-w-full">
                        {gameState.players.map((p: any) => (
                            p.nickname !== nickname && (
                                <div
                                    key={p.nickname}
                                    className={`cursor-pointer relative p-2.5 md:p-3 rounded-xl border flex flex-col min-w-[160px] sm:min-w-[180px] lg:w-52 flex-shrink-0 transition-all hover:scale-[1.02] ${
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
                                    <div className="flex justify-between items-center w-full text-xs md:text-sm">
                                        <span className={`font-bold truncate max-w-[90px] md:max-w-none ${!p.connected ? "line-through text-gray-500" : ""}`}>{p.nickname}</span>
                                        <span className="font-black text-red-400 shrink-0">{p.score} pts</span>
                                    </div>
                                    {p.tableau && p.tableau.length > 0 && (
                                        <div className="flex flex-wrap gap-1 mt-1.5 max-h-[22px] lg:max-h-none overflow-hidden">
                                            {p.tableau.map((t: any) => (
                                                <span key={t.instanceId} className="text-[8px] md:text-[9px] bg-amber-950 text-amber-400 px-1 py-0.5 rounded border border-amber-800 font-bold uppercase truncate max-w-full">📜 {t.name}</span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )
                        ))}
                    </div>
                    <div className="text-center bg-yellow-400 text-black font-black text-[10px] md:text-xs py-1 rounded-md shadow-md uppercase tracking-wider">
                        DAY {gameState.day} / 3
                    </div>
                </div>
            </div>

            {/* Informative Target Mode Banner */}
            {selectedAction && (
                <div className="bg-blue-950 border border-blue-500/50 text-center py-2.5 mx-4 md:mx-5 rounded-xl text-[11px] md:text-xs font-bold text-blue-200 flex justify-center items-center gap-3 shadow-lg z-40 animate-pulse px-3">
                    <span className="truncate">⚡ Playing <strong className="text-white font-extrabold underline">{selectedAction.card.name}</strong>: {selectedAction.validTargets.every(t => typeof t === "string") ? " Tap targeted opponent badge" : " Select highlighted noble"}</span>
                    <button onClick={() => setSelectedAction(null)} className="bg-zinc-800 hover:bg-zinc-700 text-gray-300 border border-zinc-600 px-2 py-0.5 rounded font-black text-[9px] uppercase shrink-0">Cancel</button>
                </div>
            )}

            {/* Main Line Up Grid Area */}
            <div className="relative flex-1 flex flex-col justify-center items-center w-full min-h-[220px] md:min-h-[250px] p-4">
                <div className="absolute left-10 top-1/2 -translate-y-1/2 -rotate-90 origin-left hidden lg:block select-none pointer-events-none">
                    <div className="text-8xl font-black text-gray-400 tracking-tighter opacity-[0.03] uppercase">Guillotine</div>
                </div>

                <div className="w-full max-w-4xl px-2">
                    {/* Strict 5 or 6 column grid tracking cleanly adjusted for mobile view widths */}
                    <div className="grid grid-cols-5 gap-1.5 sm:gap-4 justify-items-center items-center transition-all duration-500">
                        {gameState.lineUp.map((head: any, i: number) => {
                            const isTargetable = Array.isArray(selectedAction?.validTargets) && selectedAction.validTargets.includes(i);
                            
                            return (
                                <div
                                    key={head.instanceId}
                                    onClick={() => {
                                        if (!isMyTurn) { setFocusCard(head); return; }
                                        if (selectedAction && selectedAction.card) {
                                            if (isTargetable) {
                                                const config = actionCardConfig[selectedAction.card.key];
                                                
                                                if (config?.requiresTarget === "upTo") {
                                                    // Intercept the final payload to prompt for distance choice
                                                    setPendingUpToSelection({
                                                        index: i,
                                                        max: config.maxDistance || 1,
                                                        direction: config.direction || "forward"
                                                    });
                                                } else {
                                                    // Standard direct execution path
                                                    socket.emit("play-action-card", { roomCode, instanceId: selectedAction.card.instanceId, target: i });
                                                    setSelectedAction(null);
                                                }
                                            }
                                        } else if (i === 0) {
                                            handleExecute();
                                        } else {
                                            setFocusCard(head);
                                        }
                                    }}
                                    className={`relative w-full aspect-[2/3] max-w-[62px] sm:max-w-[110px] md:max-w-[130px] rounded-xl cursor-pointer transition-all duration-300 ease-out 
                                        md:hover:-translate-y-4 md:hover:scale-110
                                        ${isTargetable ? 'border-2 md:border-4 border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.8)] scale-105 z-50 animate-pulse' : ''} 
                                        ${i === 0 && isMyTurn && !selectedAction ? 'z-40 border-2 md:border-4 border-yellow-400 shadow-[0_0_20px_rgba(250,204,21,0.6)] scale-105' : 'z-10 shadow-sm md:shadow-xl'}`}
                                    style={{ 
                                        transform: i === 0 && isMyTurn 
                                            ? 'none' 
                                            : `rotate(${(i % 2 === 0 ? 1 : -1) * 2}deg)` 
                                    }}
                                >
                                    {/* Chop Indicator Tag */}
                                    {i === 0 && (
                                        <div className="absolute -top-6 md:-top-9 left-1/2 -translate-x-1/2 bg-yellow-400 text-black px-1.5 py-0.5 text-[7px] md:text-[10px] font-black rounded-full animate-bounce z-50 shadow-md uppercase tracking-wider whitespace-nowrap">
                                            CHOP
                                        </div>
                                    )}
                                    
                                    <img 
                                        src={`/assets/cards/images/${head.key}.jpeg`} 
                                        alt={head.name} 
                                        className="w-full h-full object-cover rounded-xl border border-white/10 brightness-110 select-none" 
                                        onError={(e) => { e.currentTarget.src = "/assets/cards/card-back.png"; }} 
                                    />
                                    
                                    <div className="absolute bottom-0.5 left-0.5 md:bottom-1 md:left-1 bg-black/70 text-[7px] sm:text-[10px] font-bold text-white px-1 md:px-1.5 py-0.5 rounded">
                                        #{i + 1}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Match Feed Action Feed */}
                {latestAction && (
                    <div className="w-full max-w-md mx-auto px-4 mt-5 z-50 relative">
                        <div 
                            onClick={() => setIsLogExpanded(!isLogExpanded)}
                            className={`bg-zinc-950/90 border border-zinc-800 shadow-2xl backdrop-blur-md transition-all duration-300 cursor-pointer hover:border-zinc-700
                                ${isLogExpanded ? 'rounded-2xl p-4' : 'rounded-full px-4 py-1.5 flex items-center justify-between gap-3'}`}
                        >
                            {!isLogExpanded ? (
                                <>
                                    <div className="flex items-center gap-2.5 flex-1 min-w-0">
                                        <span className="flex h-1.5 w-1.5 relative shrink-0">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500"></span>
                                        </span>
                                        <p className="text-[11px] md:text-xs tracking-wide text-zinc-300 font-medium truncate">
                                            <span className="text-zinc-500 uppercase font-bold mr-1">Latest:</span> 
                                            {latestAction}
                                        </p>
                                    </div>
                                    <button className="text-[9px] md:text-[10px] uppercase font-black text-red-400 tracking-wider hover:text-red-300 transition shrink-0 pl-1">
                                        History ({logs.length})
                                    </button>
                                </>
                            ) : (
                                <div className="flex flex-col w-full animate-fade-in">
                                    <div className="flex items-center justify-between border-b border-zinc-800 pb-2 mb-3">
                                        <div className="flex items-center gap-2">
                                            <span className="h-1.5 w-1.5 rounded-full bg-red-500"></span>
                                            <h4 className="text-[10px] md:text-[11px] font-bold text-zinc-400 uppercase tracking-widest">Execution Registry</h4>
                                        </div>
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); setIsLogExpanded(false); }}
                                            className="text-[9px] md:text-[10px] uppercase font-black text-zinc-500 hover:text-zinc-300 transition tracking-wider"
                                        >
                                            Minimize
                                        </button>
                                    </div>

                                    <div className="max-h-32 md:max-h-40 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                                        {logs.map((log: string, idx: number) => (
                                            <div 
                                                key={idx} 
                                                className={`text-[11px] md:text-xs tracking-wide py-1 border-l-2 pl-2.5 ${
                                                    idx === 0 
                                                        ? 'text-zinc-100 border-red-500 font-medium bg-red-950/20 rounded-r' 
                                                        : 'text-zinc-400 border-zinc-800 font-normal'
                                                }`}
                                            >
                                                {log}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Bottom Shelf Section */}
            <div className="w-full pt-6 md:pt-14 p-4 md:p-6 pb-4 flex flex-col md:flex-row justify-between items-stretch bg-gradient-to-t from-black via-black/80 to-transparent gap-6 md:gap-4 z-10">
                
                {/* Scored Collection Stack */}
                <div className="flex flex-col gap-2 max-w-full justify-end orders-2 md:order-1">
                    <div className="flex items-center gap-3">
                        <p className="text-[10px] md:text-xs uppercase font-bold text-gray-500 tracking-wider">Your Collected Pile</p>
                        {me?.tableau && me.tableau.length > 0 && (
                            <div className="flex gap-1 max-w-[50%] overflow-hidden truncate">
                                {me.tableau.map((t: any) => (
                                    <span key={t.instanceId} className="text-[8px] bg-amber-900/40 text-amber-300 border border-amber-700/60 font-black rounded px-1.5 py-0.5 uppercase truncate">📜 {t.name}</span>
                                ))}
                            </div>
                        )}
                    </div>
                    <div className="flex gap-4 md:gap-6 items-end overflow-x-auto pb-2 max-w-full scrollbar-hide h-28 md:h-32">
                        {groupedCollection && Object.keys(groupedCollection).length === 0 && (
                            <p className="text-xs text-zinc-600 italic pb-2">No heads scored yet...</p>
                        )}
                        {groupedCollection && Object.entries(groupedCollection).map(([color, heads]: [string, any]) => (
                            <div key={color} className="relative group flex flex-col items-center flex-shrink-0">
                                <div className="flex -space-x-14 md:-space-x-16 md:group-hover:-space-x-4 transition-all duration-500 ease-out h-24 md:h-28 items-end">
                                    {heads.map((head: any, i: number) => (
                                        <img 
                                            key={head.instanceId}
                                            src={`/assets/cards/images/${head.key}.jpeg`} 
                                            onClick={() => setFocusCard(head)}
                                            className={`w-14 h-20 md:w-20 md:h-28 rounded-lg border border-white/20 shadow-2xl brightness-110 transform transition-all duration-300 hover:-translate-y-4 md:hover:-translate-y-8 hover:z-50 ${BALATRO_PALETTE[color] || 'bg-zinc-800'}`}
                                            style={{ transform: `rotate(${(i % 2 === 0 ? 1 : -1) * (i * 1.5)}deg)`, zIndex: i }}
                                            onError={(e) => { e.currentTarget.src = "/assets/cards/card-back.png"; }}
                                        />
                                    ))}
                                </div>
                                <span className="mt-1 text-[9px] font-black uppercase text-gray-500 tracking-wide">{color} ({heads.length})</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Hand View Drawer */}
                <div className="flex flex-col items-stretch md:items-end gap-1.5 max-w-full md:max-w-[50%] lg:max-w-[60%] justify-end relative z-30 order-1 md:order-2">
                    <div className="flex justify-between items-center w-full px-1">
                        {isMyTurn && (
                            <div className={`px-2 py-0.5 text-xs font-black italic skew-x-[-12deg] text-white shadow-md animate-pulse ${me.mustDiscardActionCount > 0 ? 'bg-orange-600' : 'bg-red-600'}`}>
                                {me.mustDiscardActionCount > 0 ? "PENALTY: MUST DISCARD" : "YOUR TURN"}
                            </div>
                        )}
                        <p className="text-[10px] md:text-xs uppercase font-bold text-gray-500 tracking-wider ml-auto">Your Hand ({handCards.length})</p>
                    </div>
                    
                    <div className="flex -space-x-8 sm:-space-x-10 md:hover:-space-x-2 transition-all duration-500 pt-10 pb-2 px-2 overflow-x-auto md:overflow-x-visible overflow-y-visible h-36 md:h-44 items-end scrollbar-hide">
                        {handCards.map((card: any) => {
                            const hasPenalty = isMyTurn && me.mustDiscardActionCount > 0;

                            return (
                                <div key={card.instanceId} className="relative group cursor-pointer flex-shrink-0 transition-all duration-300 md:hover:-translate-y-12 md:hover:scale-125 z-10 hover:z-50">
                                    <img 
                                        src={`/assets/cards/images/${card.key}.jpeg`} 
                                        onClick={() => setFocusCard(card)} 
                                        className={`w-16 h-24 md:w-24 md:h-36 rounded-xl border-2 shadow-2xl transition-colors ${hasPenalty ? 'border-orange-500' : 'border-white/10'}`} 
                                        onError={(e) => { e.currentTarget.src = "/assets/cards/card-back.png"; }} 
                                    />
                                    
                                    {/* BUTTON PORTAL LAYER */}
                                    {isMyTurn && (
                                        <>
                                            {/* Scenario A: Fulfilling Innocent Victim Penalty */}
                                            {me.mustDiscardActionCount > 0 ? (
                                                <button 
                                                    onClick={(e) => { 
                                                        e.stopPropagation(); 
                                                        socket.emit("discard-innocent-victim-penalty", { roomCode: roomCode, instanceId: card.instanceId }); 
                                                    }} 
                                                    className="absolute -top-10 left-1/2 -translate-x-1/2 bg-orange-600 hover:bg-orange-500 font-black text-white text-[10px] px-2 py-1.5 rounded-md shadow-2xl md:opacity-0 md:group-hover:opacity-100 transition-all uppercase tracking-wider z-[100] border border-orange-400 whitespace-nowrap"
                                                >
                                                    DISCARD
                                                </button>
                                            ) : (
                                                /* Scenario B: Standard Normal Turn Play Options */
                                                me.actions > 0 && !selectedAction && (
                                                    <button 
                                                        onClick={(e) => { 
                                                            e.stopPropagation(); 
                                                            handleSelectActionCard(card); 
                                                        }} 
                                                        className="hidden md:block absolute -top-10 left-1/2 -translate-x-1/2 bg-blue-600 hover:bg-blue-500 font-black text-white text-[10px] px-3 py-1.5 rounded-md shadow-2xl opacity-0 group-hover:opacity-100 transition-all uppercase tracking-wider z-[100] border border-blue-400 whitespace-nowrap"
                                                    >
                                                        PLAY CARD
                                                    </button>
                                                )
                                            )}
                                        </>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {pendingUpToSelection && selectedAction && (
                <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-[160] flex flex-col items-center justify-center p-4">
                    <div className="bg-zinc-950 border-2 border-blue-500 rounded-2xl p-6 max-w-sm w-full text-center shadow-2xl">
                        <h3 className="text-lg font-black uppercase tracking-wider text-blue-400">Choose Distance</h3>
                        <p className="text-xs text-zinc-400 mt-1 mb-4">
                            Move {gameState.lineUp[pendingUpToSelection.index]?.name} up to {pendingUpToSelection.max} spaces {pendingUpToSelection.direction}.
                        </p>
                        
                        <div className="flex flex-col gap-2">
                            {Array.from({ length: pendingUpToSelection.max }, (_, idx) => idx + 1).map((distance) => (
                                <button
                                    key={distance}
                                    onClick={() => {
                                        // Format target with signed direction coordinates
                                        const finalDistance = pendingUpToSelection.direction === "backward" ? -distance : distance;
                                        
                                        socket.emit("play-action-card", {
                                            roomCode,
                                            instanceId: selectedAction.card.instanceId,
                                            target: { index: pendingUpToSelection.index, distance: finalDistance }
                                        });
                                        
                                        setPendingUpToSelection(null);
                                        setSelectedAction(null);
                                    }}
                                    className="w-full bg-zinc-900 hover:bg-blue-600 text-white font-bold py-2.5 rounded-lg border border-zinc-800 transition uppercase text-xs tracking-wider"
                                >
                                    {distance} Space{distance > 1 ? 's' : ''}
                                </button>
                            ))}
                            
                            <button 
                                onClick={() => setPendingUpToSelection(null)}
                                className="mt-2 text-[10px] text-zinc-500 hover:text-zinc-300 font-bold uppercase tracking-widest"
                            >
                                Back to Selection
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Full Detailed Focus Carousel Modal */}
            {focusCard && (
                <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[150] flex flex-col items-center justify-center p-4 select-none" onClick={() => setFocusCard(null)}>
                    {focusedHandIndex !== -1 && (
                        <div className="mb-3 text-[10px] md:text-xs font-bold uppercase tracking-widest text-zinc-500 text-center">
                            Card {focusedHandIndex + 1} of {handCards.length} <span className="hidden md:inline">• Use ← / → Keys to browse</span>
                        </div>
                    )}

                    <div className="flex items-center justify-center w-full max-w-3xl gap-3 md:gap-6">
                        {focusedHandIndex > 0 ? (
                            <button 
                                onClick={(e) => { e.stopPropagation(); setFocusCard(handCards[focusedHandIndex - 1]); }}
                                className="bg-zinc-900/80 hover:bg-zinc-800 text-white w-10 h-10 md:w-14 md:h-14 rounded-full border border-zinc-700/60 flex items-center justify-center font-black text-sm md:text-xl transition-all shadow-2xl"
                            >
                                ◀
                            </button>
                        ) : <div className="w-10 md:w-14" />}

                        <div className="relative group/modal flex flex-col items-center max-w-[70%] sm:max-w-sm" onClick={(e) => e.stopPropagation()}>
                            <img 
                                src={`/assets/cards/images/${focusCard.key}.jpeg`} 
                                alt={focusCard.name}
                                className="max-h-[55vh] md:max-h-[70vh] aspect-[5/7] object-contain rounded-2xl shadow-[0_0_40px_rgba(0,0,0,0.8)] border border-white/10 brightness-110"
                                onError={(e) => { e.currentTarget.src = "/assets/cards/card-back.png"; }}
                            />

                            {focusedHandIndex !== -1 && isMyTurn && me.actions > 0 && !selectedAction && (
                                <button 
                                    onClick={() => {
                                        handleSelectActionCard(focusCard);
                                        setFocusCard(null); 
                                    }}
                                    className="mt-4 md:mt-6 bg-emerald-600 hover:bg-emerald-500 text-white font-black px-6 md:px-10 py-2.5 md:py-3 rounded-xl shadow-2xl tracking-widest uppercase text-[11px] md:text-xs border border-emerald-400 transition-all w-full text-center whitespace-nowrap"
                                >
                                Play This Card
                                </button>
                            )}
                        </div>

                        {focusedHandIndex !== -1 && focusedHandIndex < handCards.length - 1 ? (
                            <button 
                                onClick={(e) => { e.stopPropagation(); setFocusCard(handCards[focusedHandIndex + 1]); }}
                                className="bg-zinc-900/80 hover:bg-zinc-800 text-white w-10 h-10 md:w-14 md:h-14 rounded-full border border-zinc-700/60 flex items-center justify-center font-black text-sm md:text-xl transition-all shadow-2xl"
                            >
                                ▶
                            </button>
                        ) : <div className="w-10 md:w-14" />}
                    </div>

                    <div className="mt-4 md:mt-6 text-zinc-600 text-[9px] md:text-[10px] tracking-widest uppercase font-bold text-center">
                        [ Tap outside to close window ]
                    </div>
                </div>
            )}

            {/* View Profile Overlay Model */}
            {viewPlayer && (
                <div className="fixed inset-0 bg-black/95 backdrop-blur-lg z-[120] flex flex-col items-center justify-center p-4 md:p-6" onClick={() => setViewPlayer(null)}>
                    <div className="text-xl md:text-3xl font-black mb-1 uppercase tracking-wider text-center text-gray-200">{viewPlayer.nickname}'s Score Pile</div>
                    <div className="text-red-400 font-black text-xs md:text-sm mb-6 md:mb-8 uppercase tracking-widest bg-red-950/40 border border-red-900/60 px-4 py-1 rounded-full">Current Tally: {viewPlayer.score} Points</div>
                    <div className="flex gap-4 md:gap-10 flex-wrap justify-center max-w-6xl overflow-y-auto max-h-[60vh] p-2 scrollbar-hide">
                        {viewedCollection && Object.entries(viewedCollection).map(([color, heads]: [string, any]) => (
                            <div key={color} className="flex flex-col items-center min-w-[120px]">
                                <div className="flex -space-x-10 md:-space-x-14">
                                    {heads.map((head: any, i: number) => (
                                        <img key={head.instanceId} src={`/assets/cards/images/${head.key}.jpeg`} className="w-16 h-24 md:w-24 md:h-36 rounded-xl border border-white/20 shadow-2xl" style={{ zIndex: i }} onError={(e) => { e.currentTarget.src = "/assets/cards/card-back.png"; }} />
                                    ))}
                                </div>
                                <span className="mt-2 text-[9px] md:text-xs font-black uppercase text-gray-400 bg-zinc-900 border border-zinc-800 px-2 py-1 rounded-md">{color} ({heads.length})</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default Game2;