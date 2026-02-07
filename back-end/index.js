const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const allCards = require("./assets/cards/cards.json");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { 
  cors: { 
    origin: process.env.FRONTEND_URL || "http://localhost:5173", // Use env variable in prod
    methods: ["GET", "POST"]
  } 
});

const rooms = {};

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

io.on("connection", (socket) => {
  console.log("A player connected:", socket.id);

  socket.on("create-room", ({ nickname }) => {
    const roomCode = Math.random().toString(36).substring(2, 6).toUpperCase(); 
    rooms[roomCode] = {
      players: [{ 
        id: socket.id, 
        nickname, 
        score: 0, 
        hand: [], 
        collection: [] 
      }],
      gameStarted: false
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
        gameStarted: false
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
        score: 0, 
        hand: [], 
        collection: [] 
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

    if (room.gameStarted) {
      console.log(`Game already started in ${code}`);
      return;
    }

    // 4. Initialize the decks
    const { nobleDeck, actionDeck } = createDecks();
    
    room.gameStarted = true;
    room.gameState = {
      lineUp: nobleDeck.splice(0, 12),
      nobleDeck: nobleDeck,
      actionDeck: actionDeck,
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

    const gs = room.gameState;
    const currentPlayer = room.players[gs.turnIndex];

    if (socket.id !== currentPlayer.id) return;

    // 1. Collect
    const noble = gs.lineUp.shift();
    currentPlayer.collection.push(noble);
    
    // Simple Score calculation (doesn't handle '*' cards yet)
    if (typeof noble.value === 'number') {
        currentPlayer.score += noble.value;
    }

    // 2. Draw an Action Card
    if (gs.actionDeck.length > 0) {
        currentPlayer.hand.push(gs.actionDeck.shift());
    }

    // 3. Turn Rotation
    gs.turnIndex = (gs.turnIndex + 1) % room.players.length;

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
      // IMPORTANT: Update the player's socket ID to the new one
      const player = room.players.find(p => p.nickname === nickname);
      if (player) {
        player.id = socket.id;
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

  socket.on("get-players", ({roomCode}) => {
    console.log(`Outputing Players in room ${roomCode}`);
    io.to(roomCode).emit("update-players", rooms[roomCode].players);
  })

  socket.on("disconnect", () => {
    let emptyRooms = [];

    for (const roomCode in rooms) {
      rooms[roomCode].players = rooms[roomCode].players.filter(player => player.id !== socket.id);
      if (rooms[roomCode].players.length === 0) {
        emptyRooms.push(roomCode); // Mark for deletion
      } else {
        io.to(roomCode).emit("update-players", rooms[roomCode].players);
      }
    }
    emptyRooms.forEach(roomCode => {
      console.log(`deleting ${roomCode}`)
      delete rooms[roomCode];
    })
    console.log("A player disconnected:", socket.id);
  });
});

server.listen(3001, () => console.log("Server running on port 3001"));
