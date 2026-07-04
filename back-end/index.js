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

const ROOM_TIMEOUT = 30 * 60 * 1000;


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

function discardCard(gs, card, meta = {}) {
  if (!gs || !card) return;

  gs.discard.push({
    ...card,
    discardedAt: Date.now(),
    ...meta
  });
}


function moveInLine(line, index, distance) {
  if (!Array.isArray(line)) return;
  if (index < 0 || index >= line.length) return;
  if (distance === 0) return;

  const newIndex = Math.max(0, Math.min(line.length - 1, index - distance));

  const [card] = line.splice(index, 1);
  line.splice(newIndex, 0, card);
}

function moveLineEffect({ gs, index, distance, conditionFn }) {
  if (index === undefined || index < 0 || index >= gs.lineUp.length) return;
  if (conditionFn && !conditionFn(gs.lineUp[index])) return;
  moveInLine(gs.lineUp, index, distance);
}

function discardFromHand(gs, player, instanceId) {
  const index = player.hand.findIndex(c => c.instanceId === instanceId);
  if (index === -1) return null;

  const [card] = player.hand.splice(index, 1);
  discardCard(gs, card);
  return card;
}

function discardFromLine(gs, index) {
  if (index < 0 || index >= gs.lineUp.length) return null;

  const [card] = gs.lineUp.splice(index, 1);
  discardCard(gs, card);
  return card;
}

function discardRandomFromHand(gs, player) {
  if (!player.hand.length) return null;

  const index = Math.floor(Math.random() * player.hand.length);
  const [card] = player.hand.splice(index, 1);
  discardCard(gs, card);
  return card;
}

function discardRandomFromLine(gs) {
  if (!gs.lineUp.length) return null; 

  const index = Math.floor(Math.random() * gs.lineUp.length);
  const [card] = gs.lineUp.splice(index, 1);
  discardCard(gs, card);
  return card;
}

function discardFromTableau(gs, player, instanceId) {
  const index = player.tableau.findIndex(c => c.instanceId === instanceId);
  if (index === -1) return null;

  const [card] = player.tableau.splice(index, 1);
  discardCard(gs, card);
  return card;
}


function reshuffleDiscardIntoDeck(gs) {
  gs.actionDeck = shuffle([...gs.actionDeck, ...gs.discard]);
  gs.discard = [];
}

const actionCardEffects = {
  // Give a noble from lineup to a target player
  a1: ({ gs, room, target, card }) => {
    if (!gs.lineUp.length) return;
    const victim = room.players.find(p => p.nickname === target);
    if (!victim) return;
    const noble = gs.lineUp.shift();
    victim.collection.push(noble);
    victim.score += noble.value;
  },

  // Rotate lineup
  a2: ({ gs, card }) => {
    if (gs.lineUp.length) gs.lineUp.push(gs.lineUp.shift());
  },

  // Move a green card
  a5: ({ gs, target }) => moveLineEffect({ gs, ...target, conditionFn: c => isColor(c, "green") }),

  // Replace a noble in line with new one from deck
  a8: ({ gs, target, card }) => {
    const removed = discardFromLine(gs, target);
    if (!removed || !gs.nobleDeck.length) return;
    gs.lineUp.splice(target, 0, gs.nobleDeck.shift());
  },

  // Extra noble for player
  a10: ({ player }) => player.extraNoble = true,

  // Discard two random nobles and shuffle lineup
  a11: ({ gs }) => {
    discardRandomFromLine(gs);
    discardRandomFromLine(gs);
    shuffle(gs.lineUp);
  },

  // Reverse the lineup (a45)
  a45: ({ gs }) => {
    gs.lineUp.reverse();
  },

  // Shuffle first 5 nobles (a33)
  a33: ({ gs }) => {
    const sub = gs.lineUp.splice(0, 5);
    shuffleArrayInPlace(sub);
    gs.lineUp.unshift(...sub);
  },

  // Draw 3 extra action cards and skip noble collection (a37)
  a37: ({ gs, player }) => {
    for (let i = 0; i < 3; i++) {
      if (gs.actionDeck.length === 0) reshuffleDiscardIntoDeck(gs);
      if (gs.actionDeck.length) player.hand.push(gs.actionDeck.shift());
    }
    player.skipNobleThisTurn = true;
  },

  // Shuffle all players' hands into action deck and redeal (a40)
  a40: ({ gs, room }) => {
    room.players.forEach(p => gs.actionDeck.push(...p.hand.splice(0)));
    shuffleArrayInPlace(gs.actionDeck);
    room.players.forEach(p => {
      for (let i = 0; i < 5 && gs.actionDeck.length; i++) {
        p.hand.push(gs.actionDeck.shift());
      }
    });
  },

  // Pick an action card from discard pile (a41)
  a41: ({ gs, player }) => {
    if (!gs.discard.length) return;
    const index = Math.floor(Math.random() * gs.discard.length);
    const [card] = gs.discard.splice(index, 1);
    player.hand.push(card);
  },

  // Target player cannot play an action next turn (a42)
  a42: ({ room, target }) => {
    const victim = room.players.find(p => p.nickname === target);
    if (!victim) return;
    victim.skipNextAction = true;
  },

  // End day and discard remaining nobles (a43)
  a43: ({ gs }) => {
    gs.discard.push(...gs.lineUp.splice(0));
    gs.dayEndedEarly = true;
  },

  // Negative support card (a47)
  a47: ({ room, target }) => {
    const victim = room.players.find(p => p.nickname === target);
    if (!victim) return;
    victim.score -= 2;
  },

  // Discard a target action card from any player (a49)
  a49: ({ gs, room, target }) => {
    const victim = room.players.find(p => p.nickname === target.player);
    if (!victim) return;
    discardFromHand(gs, victim, target.instanceId);
  },

  // Move line backwards
  a13: ({ gs, target }) => moveLineEffect({ gs, ...target, distance: -target.distance }),
  a19: ({ gs, target }) => moveLineEffect({ gs, ...target, distance: -target.distance }),

  // Move line forward fixed distance
  a20: ({ gs, target }) => moveLineEffect({ gs, index: target, distance: 4 }),
  a28: ({ gs, target }) => moveLineEffect({ gs, ...target }),
  a50: ({ gs, target }) => moveLineEffect({ gs, ...target }),

  // Conditional move by color
  a29: ({ gs, target }) => moveLineEffect({ gs, ...target, conditionFn: c => isColor(c, 'violet') }),
  a31: ({ gs, target }) => moveLineEffect({ gs, ...target, conditionFn: c => isColor(c, 'red') }),

  // Move line to start or far position
  a38: ({ gs, target }) => moveLineEffect({ gs, index: target, distance: 999 }),
  a39: ({ gs, targetIndex }) => moveLineEffect({ gs, index: targetIndex, distance: 2 }),
  a44: ({ gs, target }) => moveLineEffect({ gs, index: target, distance: 1 }),
  a46: ({ gs, target }) => moveLineEffect({ gs, index: target, distance: 3 }),
  a48: ({ gs, target, player }) => {
    moveLineEffect({ gs, index: target, distance: -1 });
    player.extraAction = true;
  },

  // Discard a card from someone else's tableau
  a49: ({ gs, room, target, card }) => {
    const victim = room.players.find(p => p.nickname === target.player);
    if (!victim) return;
    discardFromTableau(gs, victim, target.instanceId);
  },

  // Place support cards in tableau
  a4: ({ player, card }) => player.tableau.push(card),
  a6: ({ player, card }) => player.tableau.push(card),
  a16: ({ player, card }) => player.tableau.push(card),
  a18: ({ player, card }) => player.tableau.push(card),
  a21: ({ player, card }) => player.tableau.push(card),
  a32: ({ player, card }) => player.tableau.push(card)
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

io.on("connection", (socket) => {
  console.log("A player connected:", socket.id);

  socket.on("create-room", ({ nickname }) => {
    const roomCode = Math.random().toString(36).substring(2, 6).toUpperCase(); 
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
    const code = inputCode.toUpperCase(); // We must use this 'code' everywhere below

    if (!rooms[code]) {
      socket.emit("error", "This room code does not exist. Double check your code or create a new room!");
      return;
    }

    const room = rooms[code];
    const existingPlayer = room.players.find(p => p.nickname === nickname);


    if (existingPlayer) {
      existingPlayer.id = socket.id;
    } else {
      if (room.gameStarted) {
        socket.emit("error", "Game already started. Cannot join.");
        return;
      }
      // Initialize full player object
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
    
    io.to(code).emit("update-players", room.players); 
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

    gs.actionLog.unshift(`${player.nickname} played action card: "${card.name}".`);

    // Deduct action cost safely
    player.actions -= 1;
    if (player.actions < 0) player.actions = 0;

    io.to(code).emit("game-state-update", {
      players: room.players,
      ...room.gameState
    });
  });


  socket.on("get-players", ({roomCode}) => {
    console.log(`Outputing Players in room ${roomCode}`);
    io.to(roomCode).emit("update-players", rooms[roomCode].players);
  })

  socket.on("disconnect", () => {
    for (const roomCode in rooms) {
      const room = rooms[roomCode];
      const player = room.players.find(p => p.id === socket.id);

      if (player) {
        console.log(`${player.nickname} disconnected`);
        player.connected = false;

        if (room.gameStarted) {
          io.to(roomCode).emit("game-state-update", {
            players: room.players,
            ...room.gameState
          });
        } else {
          io.to(roomCode).emit("update-players", room.players);
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
