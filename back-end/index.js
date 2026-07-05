console.log("BOOTING UP...")
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const allCards = require("./assets/cards/cards.json");
const { resolveActionCard } = require("./actions.js");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { 
  cors: { 
    origin: ["https://guillotine.vercel.app", "http://localhost:5173"],
    methods: ["GET", "POST"]
  } 
});


const activeRoomTimeouts = new Map();
const ROOM_TIMEOUT = 30 * 60 * 1000;
const MAX_GLOBAL_ROOMS = 500;
const DISCONNECT_GRACE_PERIOD = 60 * 1000;
const roomCreationCooldowns = new Map();


const rooms = {};

setInterval(() => {
    const now = Date.now();
    for (const code in rooms) {
        const room = rooms[code];
        if (!room.lastActivity) continue;

        if (now - room.lastActivity > ROOM_TIMEOUT) {
            console.log(`Deleting inactive room: ${code}`);
            delete rooms[code];
        }
    }
}, 5 * 60 * 1000);

// --- Utilities ---
const shuffle = (array) => {
  const newArr = [...array];
  for (let i = newArr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
  }
  return newArr;
};

const createDecks = () => {
  const nobles = [];
  const actions = [];

  allCards.forEach(card => {
    const count = card.qty || 1;
    for (let i = 0; i < count; i++) {
      const cardInstance = { ...card, instanceId: `${card.key}-${i}` };
      if (card.key.startsWith('a')) {
        actions.push(cardInstance);
      } else {
        nobles.push(cardInstance);
      }
    }
  });

  return { 
    nobleDeck: shuffle(nobles), 
    actionDeck: shuffle(actions) 
  };
};

function updateScoreForNoble(player, noble, gameState) {
  // 1. Reset base score calculations to zero to run a clean, full-collection tally
  player.score = 0;

  // 2. Count types across your collected pile
  const palaceGuards = player.collection.filter(c => c.key === 'r1').length;
  const totalGray = player.collection.filter(c => c.color === 'gray').length;
  
  const hasCount = player.collection.some(c => c.key === 'v5');
  const hasCountess = player.collection.some(c => c.key === 'v6');

  // 3. Scan all tableau support cards affecting values
  const hasIndifferentPublic = player.tableau.some(c => c.key === 'a21');
  const churchSupportCount = player.tableau.filter(c => c.key === 'a4').length;
  const civicSupportCount = player.tableau.filter(c => c.key === 'a6').length;
  const militarySupportCount = player.tableau.filter(c => c.key === 'a32').length;

  // 4. Score each individual head card
  player.collection.forEach(n => {
    if (typeof n.value === 'number') {
      if (n.color === 'gray' && hasIndifferentPublic) {
        player.score += 1; // a21 overrides negative gray cards to +1 point
      } else {
        player.score += n.value;
      }
    } else if (n.key === 'r1') {
      // Palace guards score dynamically based on total quantity collected
      player.score += palaceGuards;
    } else if (n.key === 'g1') {
      // Tragic figure: -1 point per gray noble in score pile
      player.score -= totalGray;
    }
  });

  // 5. Apply set bonuses (Count + Countess pairs)
  if (hasCount && hasCountess) {
    player.score += 4; // Both receive +2 extra bonus points
  }

  // 6. Apply permanent support multipliers from the player's tableau field
  player.collection.forEach(n => {
    if (n.color === 'blue') player.score += (churchSupportCount * 1);
    if (n.color === 'green') player.score += (civicSupportCount * 1);
    if (n.color === 'red') player.score += (militarySupportCount * 1);
  });

  // 7. Deduct negative points from attachment cards (e.g., Tough Crowd)
  const toughCrowdCount = player.tableau.filter(c => c.key === 'a47').length;
  player.score -= (toughCrowdCount * 2);
}

function recalculateAllScores(room) {
  if (!room || !room.players) return;

  room.players.forEach(player => {
    // 1. Reset base score calculations to zero to run a clean, full-collection tally
    player.score = 0;

    // 2. Count types across your collected pile
    const palaceGuards = player.collection.filter(c => c.key === 'r1').length;
    const totalGray = player.collection.filter(c => c.color === 'gray').length;
    
    const hasCount = player.collection.some(c => c.key === 'v5');
    const hasCountess = player.collection.some(c => c.key === 'v6');

    // 3. Scan all tableau support cards affecting values
    const hasIndifferentPublic = player.tableau.some(c => c.key === 'a21');
    const churchSupportCount = player.tableau.filter(c => c.key === 'a4').length;
    const civicSupportCount = player.tableau.filter(c => c.key === 'a6').length;
    const militarySupportCount = player.tableau.filter(c => c.key === 'a32').length;

    // 4. Score each individual head card
    player.collection.forEach(n => {
      if (typeof n.value === 'number') {
        if (n.color === 'gray' && hasIndifferentPublic) {
          player.score += 1; // a21 overrides negative gray cards to +1 point
        } else {
          player.score += n.value;
        }
      } else if (n.key === 'r1') {
        // Palace guards score dynamically based on total quantity collected
        player.score += palaceGuards;
      } else if (n.key === 'g1') {
        // Tragic figure: -1 point per gray noble in score pile
        player.score -= totalGray;
      }
    });

    // 5. Apply set bonuses (Count + Countess pairs)
    if (hasCount && hasCountess) {
      player.score += 4; // Both receive +2 extra bonus points
    }

    // 6. Apply permanent support multipliers from the player's tableau field
    player.collection.forEach(n => {
      if (n.color === 'blue') player.score += (churchSupportCount * 1);
      if (n.color === 'green') player.score += (civicSupportCount * 1);
      if (n.color === 'red') player.score += (militarySupportCount * 1);
    });

    // 7. Deduct negative points from attachment cards (e.g., Tough Crowd)
    const toughCrowdCount = player.tableau.filter(c => c.key === 'a47').length;
    player.score -= (toughCrowdCount * 2);
  });
}

io.on("connection", (socket) => {
  console.log("A player connected:", socket.id);

  socket.on("create-room", ({ nickname }) => {
    if (Object.keys(rooms).length >= MAX_GLOBAL_ROOMS) {
      return socket.emit("error", "Server is at full capacity. Please try again later.");
    }
    const now = Date.now();
    const lastCreate = roomCreationCooldowns.get(socket.id) || 0;
    
    if (now - lastCreate < 5000) {
      return socket.emit("error", "You are creating rooms too fast!");
    }
    roomCreationCooldowns.set(socket.id, now);

    const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    rooms[roomCode] = {
      players: [{ 
        id: socket.id, 
        nickname, 
        score: 0, 
        actions: 1,
        extraAction: false,
        hand: [], 
        collection: [],
        tableau: [] 
      }],
      gameStarted: false, 
      lastActivity: Date.now()
    };
    socket.join(roomCode);
    socket.emit("room-created", roomCode);
    io.to(roomCode).emit("update-players", rooms[roomCode].players);
  });

  socket.on("join-room", ({ inputCode, nickname }) => {
    if (!inputCode) return;
    const code = inputCode.toUpperCase();

    if (!rooms[code]) {
      socket.emit("error", "This room code does not exist. Double check your code or create a new room!");
      return;
    }

    const room = rooms[code];
    const existingPlayer = room.players.find(p => p.nickname === nickname);

    if (existingPlayer) {
      // DUPLICATE NICKNAME CHECK: 
      // If the player is already in the room AND is still actively connected, block the new connection.
      if (existingPlayer.connected && existingPlayer.id !== socket.id) {
        socket.emit("error", `The nickname "${nickname}" is already taken in this room. Please choose another!`);
        return;
      }
      
      // If they were disconnected (connected === false), allow them to reclaim their spot
      existingPlayer.id = socket.id;
      existingPlayer.connected = true; // Mark them back as active
    } else {
      if (room.gameStarted) {
        socket.emit("error", "Game already started. Cannot join.");
        return;
      }
      
      // Max room capacity check (Guillotine maxes out at 5 players)
      if (room.players.length >= 5) {
        socket.emit("error", "This room is full! Max 5 players allowed.");
        return;
      }

      // Initialize new player object safely
      room.players.push({ 
        id: socket.id, 
        nickname, 
        connected: true,
        score: 0, 
        actions: 1,
        extraAction: false,
        hand: [], 
        collection: [], 
        tableau: []  
      });
    }

    socket.join(code);
    socket.emit("join-success", code);
    
    // Always broadcast the updated player states to everyone
    if (room.gameStarted) {
      io.to(code).emit("game-state-update", {
        players: room.players,
        ...room.gameState
      });
    } else {
      io.to(code).emit("update-players", room.players); 
    }
    
    console.log(`Player ${nickname} joined Room ${code}`);
  });


  socket.on("start-game", ({ roomCode }) => {
    // 1. Safety check for missing input
    if (!roomCode) {
      console.log("Start game failed: No roomCode provided");
      return;
    }

    // 2. Normalize to Uppercase to match the 'rooms' key
    const code = roomCode.toUpperCase();
    const room = rooms[code];

    console.log(`Attempting to start game in room: ${code}`);

    // 3. Check if room exists
    if (!room) {
      console.log(`Room ${code} not found. Current rooms:`, Object.keys(rooms));
      return;
    }

    room.lastActivity = Date.now();

    if (room.gameStarted) {
      console.log(`Game already started in ${code}`);
      return;
    }

    // 4. Initialize the decks
    const { nobleDeck, actionDeck } = createDecks();

    console.log("nobleDeck:", nobleDeck?.length, "actionDeck:", actionDeck?.length);
    console.log("typeof nobleDeck:", typeof nobleDeck);
    
    room.gameStarted = true;
    room.gameState = {
      lineUp: nobleDeck.splice(0, 12),
      nobleDeck: nobleDeck,
      actionDeck: actionDeck,
      discard: [],
      turnIndex: 0,
      day: 1, 
      actionLog: ["The match has begun! Viva la Revolución!"]
    };

    // 5. Deal 5 action cards to each player
    // Ensure players have the 'hand' property initialized
    room.players.forEach(player => {
        player.hand = room.gameState.actionDeck.splice(0, 5);
        player.score = 0;
        player.collection = [];
    });

    console.log(`Game successfully started in room ${code}`);

    // 6. Notify everyone in the room
    io.to(code).emit("game-state-update", {
        players: room.players,
        ...room.gameState
    });
  });

  socket.on("execute-noble", ({ roomCode }) => {
    const code = roomCode.toUpperCase();
    const room = rooms[code];
    if (!room || !room.gameStarted) return;

    room.lastActivity = Date.now();

    const gs = room.gameState;
    let currentPlayer = room.players[gs.turnIndex];
    if (socket.id !== currentPlayer.id) return;

    if (currentPlayer.mustDiscardActionCount > 0 && currentPlayer.hand.length > 0) {
      socket.emit("error", "You must fulfill your pending Innocent Victim discard penalties before executing a noble!");
      return;
    }

    // Fallback array initialization to safeguard against server exceptions
    if (!Array.isArray(gs.actionLog)) {
        gs.actionLog = [];
    }

    let actionsTakenText = [];
    let earlyDayFledText = "";

    // --- 0. CONFUSION IN LINE (a9) ---
    if (currentPlayer.triggerLineShuffleNextTurn) {
        gs.lineUp.sort(() => Math.random() - 0.5);
        currentPlayer.triggerLineShuffleNextTurn = false;
        console.log(`Line randomized by Confusion in Line for ${currentPlayer.nickname}!`);
        actionsTakenText.push("The lineup was shuffled by Confusion in Line!");
    }

    // Guard: Check if a card effect forces the player to skip collecting a noble (e.g., a37)
    if (currentPlayer.skipNobleThisTurn) {
        currentPlayer.skipNobleThisTurn = false; // Reset modifier
        console.log(`${currentPlayer.nickname} skipped noble collection due to card effect.`);
        gs.actionLog.unshift(`${currentPlayer.nickname} skipped their execution phase due to an action card restriction.`);
    } else if (gs.lineUp.length > 0) {
        // 1. Collect the noble at the front of the line
        const noble = gs.lineUp.shift();

        // Handle "The Clown" (g4): passes to NEXT player in rotation sequence
        if (noble.key === 'g4') {
            const nextIndex = (gs.turnIndex + 1) % room.players.length;
            const victim = room.players[nextIndex];
            victim.collection.push(noble);
            updateScoreForNoble(victim, noble, gs);
            console.log(`Clown collected! Passed to ${victim.nickname}'s score pile.`);
            actionsTakenText.push(`${currentPlayer.nickname} chopped The Clown, passing them to ${victim.nickname}!`);
        } else {
            currentPlayer.collection.push(noble);
            updateScoreForNoble(currentPlayer, noble, gs);
            actionsTakenText.push(`${currentPlayer.nickname} executed ${noble.name} (${noble.value >= 0 ? '+' : ''}${noble.value} pts).`);
            
            // Handle Innocent Victim (g2): must discard an action card from hand
            if (noble.key === 'g2') {
                currentPlayer.mustDiscardActionCount = (currentPlayer.mustDiscardActionCount || 0) + 1;
                actionsTakenText.push(`Innocent Victim forces ${currentPlayer.nickname} to discard an action card.`);
            }
        }

        // --- TRIGGER IMMEDIATE HEAD EFFECTS UPON COLLECTION ---
        
        // Lady in Waiting (v2), Lady (v8), Lord (v9): Draw an extra action card
        if (['v2', 'v8', 'v9'].includes(noble.key)) {
            if (gs.actionDeck.length > 0) {
                currentPlayer.hand.push(gs.actionDeck.shift());
                actionsTakenText.push(`${noble.name}'s effect triggers: ${currentPlayer.nickname} draws an action card.`);
            }
        }
        
        // Rival Executioner (e1): Collect top noble of the noble deck directly
        if (noble.key === 'e1' && gs.nobleDeck.length > 0) {
            const bonusNoble = gs.nobleDeck.shift();
            currentPlayer.collection.push(bonusNoble);
            updateScoreForNoble(currentPlayer, bonusNoble, gs);
            actionsTakenText.push(`Rival Executioner trigger! ${currentPlayer.nickname} also claims ${bonusNoble.name} (${bonusNoble.value >= 0 ? '+' : ''}${bonusNoble.value} pts) from the deck.`);
        }

        // Captain of the Guard (r3), General (r5): Add a noble from deck to the end of the line
        if (['r3', 'r5'].includes(noble.key) && gs.nobleDeck.length > 0) {
            const addedNoble = gs.nobleDeck.shift();
            gs.lineUp.push(addedNoble);
            actionsTakenText.push(`${noble.name} calls reinforcements: ${addedNoble.name} added to the end of the line.`);
        }

        // Fast Noble (v7): Collect an additional noble immediately from the front of the line
        if (noble.key === 'v7' && gs.lineUp.length > 0) {
            const extraNoble = gs.lineUp.shift();
            currentPlayer.collection.push(extraNoble);
            updateScoreForNoble(currentPlayer, extraNoble, gs);
            actionsTakenText.push(`Fast Noble trigger! ${currentPlayer.nickname} immediately executes the next noble in line: ${extraNoble.name}.`);
        }

        // Robespierre (v12): Forces immediate day end
        if (noble.key === 'v12') {
            gs.dayEndedEarly = true;
        }
    }

    // Check if an action card (like Scarlet Pimpernel a43) or Robespierre triggered early day end
    if (gs.dayEndedEarly) {
        const discardedCount = gs.lineUp.length;
        gs.discard.push(...gs.lineUp.splice(0)); // Discard remaining nobles in line
        gs.dayEndedEarly = false; // Reset trigger flag
        earlyDayFledText = ` Early Day End! ${discardedCount} remaining nobles fled to the discard pile.`;
    }

    // 2. Draw a standard Action Card at the end of the turn phase
    if (gs.actionDeck.length > 0) {
        currentPlayer.hand.push(gs.actionDeck.shift());
    }

    // 3. Turn Rotation Setup & Double Feature (a10) Handling
    let turnStatusText = "";
    if (currentPlayer.extraNoble) {
        currentPlayer.extraNoble = false; // Consume effect
        currentPlayer.actions = 1;        // Replenish action point for their immediate consecutive turn
        console.log(`${currentPlayer.nickname} takes an extra turn via Double Feature.`);
        turnStatusText = ` Double Feature! It is still ${currentPlayer.nickname}'s turn.`;
    } else {
        // Normal turn pass rotation
        gs.turnIndex = (gs.turnIndex + 1) % room.players.length;
        const nextPlayer = room.players[gs.turnIndex];
        
        // Check if next player was targeted by Rush Job (a42)
        if (nextPlayer.skipNextAction) {
            nextPlayer.actions = 0; // Skip action phase
            nextPlayer.skipNextAction = false; // Reset modifier
            console.log(`${nextPlayer.nickname}'s action phase skipped via Rush Job.`);
            turnStatusText = ` Next up: ${nextPlayer.nickname} (Action Phase skipped by Rush Job).`;
        } else {
            nextPlayer.actions = 1; // Replenish action standard
            turnStatusText = ` Next up: ${nextPlayer.nickname}.`;
        }
    }

    // 4. Check for End of Day (Either line is empty naturally or cleared by forced card effects)
    if (gs.lineUp.length === 0) {
        if (gs.day < 3) {
            gs.day += 1;
            gs.lineUp = gs.nobleDeck.splice(0, 12); // Deal out next 12 cards
            
            // Reset actions for whomever's turn it actually is to start the new day
            room.players.forEach(p => { p.actions = 0; });
            room.players[gs.turnIndex].actions = 1; 

            // Unshift unified text summary block of everything that transpired this phase to history
            const baseTurnSummary = actionsTakenText.join(" ");
            gs.actionLog.unshift(`${baseTurnSummary}${earlyDayFledText} Day completed! Transitioning to Day ${gs.day}. 12 new nobles placed in line.`);

            io.to(code).emit("new-day", { day: gs.day });
            console.log(`Day ended. Transitioning to Day ${gs.day}`);
        } else {
            console.log("Day 3 finished. Game Over!");
            
            const baseTurnSummary = actionsTakenText.join(" ");
            gs.actionLog.unshift(`${baseTurnSummary}${earlyDayFledText} Day 3 is over! The game has finished.`);
            
            io.to(code).emit("game-over", { players: room.players });
            
            // Broadcast state update before returning to render end results smoothly
            io.to(code).emit("game-state-update", {
                players: room.players,
                ...room.gameState
            });
            return;
        }
    } else {
        // If the lineup is not empty, compile the turn sequence strings normally
        const baseTurnSummary = actionsTakenText.join(" ");
        gs.actionLog.unshift(`${baseTurnSummary}${earlyDayFledText}${turnStatusText}`);
    }

    // 5. Broadcast complete state update to all room occupants
    io.to(code).emit("game-state-update", {
        players: room.players,
        ...room.gameState
    });
});

  socket.on("request-game-state", ({ roomCode, nickname }) => {
    const code = roomCode?.toUpperCase();
    const room = rooms[code];

    if (activeRoomTimeouts.has(code)) {
      console.log(`Player requesting state! Canceling deletion timeout for room: ${code}`);
      clearTimeout(activeRoomTimeouts.get(code));
      activeRoomTimeouts.delete(code);
    }
    
    console.log(`State requested for Room: ${code} by ${nickname}`);

    if (room && room.gameStarted) {
      const player = room.players.find(p => p.nickname === nickname);
      if (player) {
        player.id = socket.id;
        player.connected = true;
        socket.join(code);

        io.to(code).emit("game-state-update", {
          players: room.players,
          ...room.gameState
        });

        console.log(`Updated socket ID for ${nickname} to ${socket.id}`);
      }

      socket.emit("game-state-update", {
        players: room.players,
        ...room.gameState
      });
    } else {
      console.log(`Request failed. Room exists: ${!!room}, Started: ${room?.gameStarted}`);
      socket.emit("error", "This game session has expired or does not exist.");
    }
  });

  socket.on("play-action-card", ({ roomCode, instanceId, target }) => {
    const code = roomCode.toUpperCase();
    const room = rooms[code];
    if (!room || !room.gameStarted) return;

    room.lastActivity = Date.now(); 
    const gs = room.gameState;
    const player = room.players[gs.turnIndex];

    if (socket.id !== player.id) return;
    
    // --- NOBLE RESTRICTION: Unpopular Judge (e4) ---
    if (gs.lineUp.length > 0 && gs.lineUp[0].key === 'e4') {
      socket.emit("error", "The Unpopular Judge is at the front of the line! No action cards can be played.");
      return;
    }

    // --- NOBLE RESTRICTION: Innocent Victim Hand Block ---
    if (player.mustDiscardActionCount > 0) {
      socket.emit("error", "You must manually discard an action card to satisfy the Innocent Victim before playing cards.");
      return;
    }

    // Rule Check: Skip next action modifier
    if (player.skipNextAction) {
      player.skipNextAction = false;
      socket.emit("error", "Your action phase was skipped this turn by an enemy card!");
      return;
    }

    if (player.actions <= 0) {
      socket.emit("error", "No actions remaining this turn.");
      return;
    }

    const index = player.hand.findIndex(c => c.instanceId === instanceId);
    if (index === -1) return;

    // Pull card from hand
    const [card] = player.hand.splice(index, 1);

    resolveActionCard({ room, player, card, target });

    recalculateAllScores(room);

    gs.actionLog.unshift(`${player.nickname} played action card: "${card.name}".`);

    // --- NOBLE RESTRICTION: Master Spy (r6) Trigger ---
    const spyIdx = gs.lineUp.findIndex(n => n.key === 'r6');
    if (spyIdx !== -1) {
      const [spyCard] = gs.lineUp.splice(spyIdx, 1);
      gs.lineUp.push(spyCard);
      gs.actionLog.unshift("The Master Spy sneaks to the end of the line after an action card was played!");
    }

    // Deduct action cost safely
    player.actions -= 1;
    if (player.actions < 0) player.actions = 0;

    io.to(code).emit("game-state-update", {
      players: room.players,
      ...room.gameState
    });
  });

  socket.on("discard-innocent-victim-penalty", ({ roomCode, instanceId }) => {
    const code = roomCode.toUpperCase();
    const room = rooms[code];
    if (!room || !room.gameStarted) return;

    const gs = room.gameState;
    const player = room.players[gs.turnIndex];
    if (socket.id !== player.id) return;

    if (!player.mustDiscardActionCount || player.mustDiscardActionCount <= 0) return;

    const cardIdx = player.hand.findIndex(c => c.instanceId === instanceId);
    if (cardIdx !== -1) {
      const [discarded] = player.hand.splice(cardIdx, 1);
      gs.discard.push(discarded);
      player.mustDiscardActionCount -= 1;
      
      gs.actionLog.unshift(`${player.nickname} discarded "${discarded.name}" to satisfy the Innocent Victim.`);
      
      io.to(code).emit("game-state-update", {
        players: room.players,
        ...room.gameState
      });
    }
  });

  socket.on("get-players", ({roomCode}) => {
    console.log(`Outputing Players in room ${roomCode}`);
    io.to(roomCode).emit("update-players", rooms[roomCode].players);
  })

  socket.on("disconnect", () => {
    // 1. Clean up rate limiting maps
    roomCreationCooldowns.delete(socket.id);

    for (const roomCode in rooms) {
      const room = rooms[roomCode];
      const playerIndex = room.players.findIndex(p => p.id === socket.id);

      if (playerIndex !== -1) {
        const player = room.players[playerIndex];
        console.log(`${player.nickname} disconnected from room ${roomCode}`);

        if (room.gameStarted) {
          // ACTIVE GAME: Flag them as disconnected so they can reconnect later
          player.connected = false;
          
          io.to(roomCode).emit("game-state-update", {
            players: room.players,
            ...room.gameState
          });
        } else {
          // NON-ACTIVE GAME: Completely remove them from the lobby roster
          room.players.splice(playerIndex, 1);
          io.to(roomCode).emit("update-players", room.players);
        }

        // Check if anyone is still alive in this room
        const totalConnected = room.players.filter(p => p.connected !== false).length;

        if (totalConnected === 0) {
          if (room.gameStarted) {
            // ACTIVE GAME: Wait 60 seconds before deleting to allow re-connections
            if (!activeRoomTimeouts.has(roomCode)) {
              console.log(`Room ${roomCode} is empty but active. Starting ${DISCONNECT_GRACE_PERIOD / 1000}s deletion countdown...`);
              
              const timeoutId = setTimeout(() => {
                console.log(`Grace period expired. Deleting active room: ${roomCode}`);
                delete rooms[roomCode];
                activeRoomTimeouts.delete(roomCode);
              }, DISCONNECT_GRACE_PERIOD);

              activeRoomTimeouts.set(roomCode, timeoutId);
            }
          } else {
            // UNSTARTED GAME: No one cares, delete immediately
            console.log(`Lobby room ${roomCode} is empty. Deleting immediately...`);
            delete rooms[roomCode];
          }
        }
      }
    }

    console.log("A player disconnected:", socket.id);
  });
});

const PORT = process.env.PORT || 3001;

server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
});
