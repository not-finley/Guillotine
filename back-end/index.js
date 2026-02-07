const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*", // Allow frontend access
  },
});

const rooms = {}; // Store active lobbies

io.on("connection", (socket) => {
  console.log("A player connected:", socket.id);

  socket.on("create-room", ({ nickname }) => {
    const roomCode = Math.random().toString(36).substring(2, 6); // Generate unique code
    rooms[roomCode] = {
      players: [{ id: socket.id, nickname }],
      gameStarted: false
    };
    socket.join(roomCode);
    socket.emit("room-created", roomCode);
    console.log(`Room ${roomCode} created`);
    io.to(roomCode).emit("update-players", rooms[roomCode].players);
    console.log(`${nickname} created Room ${roomCode}`);
  });

  socket.on("join-room", ({ inputCode, nickname }) => {
    if (!rooms[inputCode]) {
      rooms[inputCode] = {
        players: [{ id: socket.id, nickname }],
        gameStarted: false
      };
    }


    const existingPlayer = rooms[inputCode].players.find(p => p.nickname === nickname);

    if (existingPlayer) {
      existingPlayer.id = socket.id;
    } else {
      if (rooms[inputCode].gameStarted) {
        socket.emit("error", "Game already started. Cannot join.");
        return;
      }
      rooms[inputCode].players.push({ id: socket.id, nickname });
    }
    socket.join(inputCode);
    io.to(inputCode).emit("update-players", rooms[inputCode].players); // Notify room
    console.log(`Player ${nickname} joined Room ${inputCode}`);
  });


  socket.on("start-game", ({roomCode}) => {
    console.log(`Game starting in room ${roomCode}`)
    if (!rooms[roomCode]) return;
    if (rooms[roomCode].gameStarted) return;

    rooms[roomCode].gameStarted = true;
    io.to(roomCode).emit("start-game");
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
