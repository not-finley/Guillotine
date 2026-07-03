console.log("BOOTING UP...")
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const allCards = require("./assets/cards/cards.json");

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
    discardEffect(gs, card);
  },

  // Rotate lineup
  a2: ({ gs, card }) => {
    if (gs.lineUp.length) gs.lineUp.push(gs.lineUp.shift());
    discardEffect(gs, card);
  },

  // Move a green card
  a5: ({ gs, target }) => moveLineEffect({ gs, ...target, conditionFn: c => isColor(c, "green") }),

  // Replace a noble in line with new one from deck
  a8: ({ gs, target, card }) => {
    const removed = discardFromLine(gs, target);
    if (!removed || !gs.nobleDeck.length) return;
    gs.lineUp.splice(target, 0, gs.nobleDeck.shift());
    discardEffect(gs, card);
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
    discardEffect(gs, card);
  },

  // Place support cards in tableau
  a4: ({ player, card }) => player.tableau.push(card),
  a6: ({ player, card }) => player.tableau.push(card),
  a16: ({ player, card }) => player.tableau.push(card),
  a18: ({ player, card }) => player.tableau.push(card),
  a21: ({ player, card }) => player.tableau.push(card),
  a32: ({ player, card }) => player.tableau.push(card)
};



function resolveActionCard({ room, player, card, target }) {
  const gs = room.gameState;
  const effectFn = actionCardEffects[card.key];

  if (!effectFn) return;
  effectFn({ gs, room, player, card, target });

  if (!gs.discard.includes(card) && !["a4","a6","a16","a18","a21","a32"].includes(card.key)) {
    gs.discard.push(card);
  }
}

function updateScoreForNoble(player, noble, gameState) {

    if (typeof noble.value === 'number') {
      player.score += noble.value;
      return;
    }

    switch (noble.key) {
        case 'r1':
            const palaceGuardCount = player.collection.filter(c => c.key === 'r1').length;
            const previousR1Points = ((palaceGuardCount - 1) ** 2);
            player.score -= previousR1Points;
            const newR1Points = palaceGuardCount * palaceGuardCount;
            player.score += newR1Points;
            break;
        case 'extra-card':
            // Draw an extra card from action deck if available
            if (gameState.actionDeck.length > 0) {
                player.hand.push(gameState.actionDeck.shift());
            }
            break;
        case '*':
            // '*' means some custom scoring logic
            // e.g., 1 point per 3 nobles collected
            player.score += Math.floor(player.collection.length / 3);
            break;
    }
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
      // If room doesn't exist, we create it (normalized)
      rooms[code] = {
        players: [],
        gameStarted: false,
        lastActivity: Date.now()
      };
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
      day: 1
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
    const currentPlayer = room.players[gs.turnIndex];
    if (socket.id !== currentPlayer.id) return;

    // 1. Collect
    const noble = gs.lineUp.shift();
    currentPlayer.collection.push(noble);

    updateScoreForNoble(currentPlayer, noble, gs);

    // 2. Draw an Action Card
    if (gs.actionDeck.length > 0) {
        currentPlayer.hand.push(gs.actionDeck.shift());
    }

    // 3. Turn Rotation
    gs.turnIndex = (gs.turnIndex + 1) % room.players.length;

    const nextPlayer = room.players[gs.turnIndex];
    nextPlayer.actions =  1;

    // 4. Check for End of Day
    if (gs.lineUp.length === 0) {
        if (gs.day < 3) {
            gs.day += 1;
            gs.lineUp = gs.nobleDeck.splice(0, 12);
            io.to(code).emit("new-day", { day: gs.day });
        } else {
            io.to(code).emit("game-over", { players: room.players });
            return;
        }
    }

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

    if (player.actions <= 0) {
      socket.emit("error", "No actions remaining this turn.");
      return;
    }


    const index = player.hand.findIndex(c => c.instanceId === instanceId);
    if (index === -1) return;

    const card = player.hand.splice(index, 1)[0];

    resolveActionCard({ room, player, card, target });

    if (!player.extraAction) {
      player.actions -= 1;
    } else {
      player.actions = 1;
      player.extraAction = false;
    }

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
