// socketServer.js  ── matchmaking + realtime game transport
import { Server } from "socket.io";

export default function initSocketServer(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: "http://localhost:5173",   // <- your front-end
      credentials: true,
    },
  });

  /* ────────────────── SIMPLE QUEUE MATCHMAKER ────────────────── */
  const waiting = { goat: [], tiger: [] };

  function freshBoard() {
    return {
      goats: [],
      tigers: [
        { row: 1, col: 1 },
        { row: 1, col: 5 },
        { row: 5, col: 1 },
        { row: 5, col: 5 },
      ],
    };
  }

  io.on("connection", (socket) => {
    /* player asks to find match */
    socket.on("find-match", ({ role }) => {
      const oppRole = role === "goat" ? "tiger" : "goat";

      if (waiting[oppRole].length) {
        const rival = waiting[oppRole].shift();
        const roomId = `${socket.id.slice(0,4)}-${rival.id.slice(0,4)}`;

        socket.join(roomId);
        rival.join(roomId);

        io.to(roomId).emit("match-found", {
          roomId,
          startBoard: freshBoard(),
          startTurn : "goat",
        });
      } else {
        waiting[role].push(socket);
      }
    });

    socket.on("cancel-find", ({role})=>{
        if(!role) return;
        waiting[role] = waiting[role].filter(s=>s.id !== socket.id);
    });

    /* goat placement */
    socket.on("goat-place", ({ roomId, to }) => {
      const state = io.sockets.adapter.rooms.get(roomId).state;
      state.board.goats.push(to);
      state.turn = "tiger";
      io.to(roomId).emit("state", state);
    });

    /* normal move */
    socket.on("move", ({ roomId, from, to }) => {
      const st   = io.sockets.adapter.rooms.get(roomId).state;
      const arr  = st.turn === "goat" ? st.board.goats : st.board.tigers;
      const idx  = arr.findIndex(p => p.row === from.row && p.col === from.col);
      arr[idx]   = to;
      st.turn    = st.turn === "goat" ? "tiger" : "goat";
      io.to(roomId).emit("state", st);
    });

    /* clean up */
    socket.on("disconnect", () => {
      ["goat", "tiger"].forEach(r => {
        waiting[r] = waiting[r].filter(s => s.id !== socket.id);
      });
    });
  });

  /* attach a state skeleton when room created */
  io.of("/").adapter.on("create-room", (roomId) => {
    io.sockets.adapter.rooms.get(roomId).state = {
      board: freshBoard(),
      turn : "goat",
    };
  });
}

