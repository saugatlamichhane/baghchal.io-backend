// socketServer.js  ── matchmaking + realtime game transport
import { Server } from "socket.io";
import User from "./models/User.js";
import Challenge from "./models/Challenge.js";

const VALID_EDGES = new Set([
  "1-1:1-2",
  "1-2:1-3",
  "1-3:1-4",
  "1-4:1-5",
  "2-1:2-2",
  "2-2:2-3",
  "2-3:2-4",
  "2-4:2-5",
  "3-1:3-2",
  "3-2:3-3",
  "3-3:3-4",
  "3-4:3-5",
  "4-1:4-2",
  "4-2:4-3",
  "4-3:4-4",
  "4-4:4-5",
  "5-1:5-2",
  "5-2:5-3",
  "5-3:5-4",
  "5-4:5-5",
  "1-1:2-1",
  "1-2:2-2",
  "1-3:2-3",
  "1-4:2-4",
  "1-5:2-5",
  "2-1:3-1",
  "2-2:3-2",
  "2-3:3-3",
  "2-4:3-4",
  "2-5:3-5",
  "3-1:4-1",
  "3-2:4-2",
  "3-3:4-3",
  "3-4:4-4",
  "3-5:4-5",
  "4-1:5-1",
  "4-2:5-2",
  "4-3:5-3",
  "4-4:5-4",
  "4-5:5-5",
  "1-1:2-2",
  "2-2:3-3",
  "3-3:4-4",
  "4-4:5-5",
  "1-3:2-4",
  "2-4:3-5",
  "3-1:4-2",
  "4-2:5-3",
  "1-3:2-2",
  "2-2:3-1",
  "1-5:2-4",
  "2-4:3-3",
  "3-3:4-2",
  "4-2:5-1",
  "3-5:4-4",
  "4-4:5-3",

  // And so on — include every valid line in the real board (can generate programmatically too)
]);
async function updateStats(io, roomId, winner) {
  const room = io.sockets.adapter.rooms.get(roomId);
  if (!room || !room.meta) return;

  const { goat, tiger } = room.meta;
  const winnerId = winner === "goat" ? goat : tiger;
  const loserId = winner === "goat" ? tiger : goat;

  const K = 16;

  try {
    // Fetch both users
    const [winnerUser, loserUser] = await Promise.all([
      User.findOne({ uid: winnerId }),
      User.findOne({ uid: loserId }),
    ]);

    if (!winnerUser || !loserUser) {
      console.error("❌ One or both users not found");
      return;
    }

    // Calculate expected scores
    const expectedWin =
      1 / (1 + Math.pow(10, (loserUser.elo - winnerUser.elo) / 400));
    const expectedLose = 1 - expectedWin;

    // Calculate new Elo ratings
    const winnerNewElo = Math.round(winnerUser.elo + K * (1 - expectedWin));
    const loserNewElo = Math.round(loserUser.elo + K * (0 - expectedLose));

    // Update both users
    await Promise.all([
      User.updateOne(
        { uid: winnerId },
        {
          $inc: { wins: 1 },
          $set: { elo: winnerNewElo },
        }
      ),
      User.updateOne(
        { uid: loserId },
        {
          $inc: { losses: 1 },
          $set: { elo: loserNewElo },
        }
      ),
    ]);

    console.log(`📊 Stats updated: ${winner} won, Elo updated`);
  } catch (err) {
    console.error("❌ Failed to update stats:", err);
  }
}

function edgeKey(a, b) {
  const [p1, p2] = [a, b].sort((x, y) => {
    if (x.row === y.row) return x.col - y.col;
    return x.row - y.row;
  });
  return `${p1.row}-${p1.col}:${p2.row}-${p2.col}`;
}

function tigerHasValidMove(board) {
  return board.tigers.some((from) => {
    // Check normal move
    const directions = [
      { dr: -1, dc: 0 },
      { dr: 1, dc: 0 },
      { dr: 0, dc: -1 },
      { dr: 0, dc: 1 },
      { dr: -1, dc: -1 },
      { dr: -1, dc: 1 },
      { dr: 1, dc: -1 },
      { dr: 1, dc: 1 },
    ];

    for (const { dr, dc } of directions) {
      const to = { row: from.row + dr, col: from.col + dc };
      const key = edgeKey(from, to);

      const occupied =
        board.goats.some((g) => g.row === to.row && g.col === to.col) ||
        board.tigers.some((t) => t.row === to.row && t.col === to.col);

      if (VALID_EDGES.has(key) && !occupied) {
        return true;
      }
    }

    // Check jump move
    for (const { dr, dc } of directions) {
      const mid = { row: from.row + dr, col: from.col + dc };
      const to = { row: from.row + 2 * dr, col: from.col + 2 * dc };
      const edge1 = edgeKey(from, mid);
      const edge2 = edgeKey(mid, to);

      const midHasGoat = board.goats.some(
        (g) => g.row === mid.row && g.col === mid.col
      );
      const toOccupied =
        board.goats.some((g) => g.row === to.row && g.col === to.col) ||
        board.tigers.some((t) => t.row === to.row && t.col === to.col);

      if (
        VALID_EDGES.has(edge1) &&
        VALID_EDGES.has(edge2) &&
        midHasGoat &&
        !toOccupied
      ) {
        return true;
      }
    }

    return false;
  });
}

export default function initSocketServer(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: "https://baghchal.io", // <- your front-end
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
      goatsKilled: 0,
    };
  }

  function getRoomState(roomId) {
    const room = io.sockets.adapter.rooms.get(roomId);
    if (!room) return null;
    if (!room.state) {
      // Attach state if missing
      room.state = {
        board: freshBoard(),
        turn: "goat",
      };
    }
    return room.state;
  }

  io.on("connection", (socket) => {
    /* player asks to find match */

    socket.on("join_challenge", ({ challengeId }) => {
      socket.join(challengeId);
      console.log(`📥 ${socket.id} joined room ${challengeId}`);
    });

    socket.on("make-goat-place", async ({ challengeId, board, turn }) => {
      try {
        const challenge = await Challenge.findById(challengeId);
        if (!challenge || challenge.status !== "in_progress") return;

        // Check if move is valid
        const goatLimitReached = board.goats.length >= 20;

        if (goatLimitReached) {
          return; // invalid placement
        }

        // Save new board state
        await Challenge.findByIdAndUpdate(challengeId, {
          board,
          turn,
          updatedAt: new Date(),
        });

        // Notify other player
        socket.to(challengeId).emit("move_made", { board, turn });
      } catch (err) {
        console.error("❌ Error placing goat:", err);
      }
    });

    // 👉 Handle move and broadcast to room
    socket.on("make_move", async ({ challengeId, board, turn }) => {
      try {
        // Save new board state in DB
        await Challenge.findByIdAndUpdate(challengeId, {
          board,
          turn,
          updatedAt: new Date(),
        });

        // Broadcast move to the other player
        socket.to(challengeId).emit("move_made", { board, turn });
      } catch (err) {
        console.error("❌ Move saving failed:", err);
      }
      const challenge = await Challenge.findById(challengeId);
      if (turn === "tiger" && !tigerHasValidMove(board)) {
        io.to(challengeId).emit("game-over", {
          winnerUid: challenge.challengerUid,
        });
        // await updateStats(io, challengeId, "goat");
        return;
      }
      console.log(`goats killed ${board.goatsKilled}`);
      if (board.goatsKilled >= 5) {
        console.log(
          `Game over: Tigers win in room ${challengeId}, winnerUid: ${challenge.challengedUid}`
        );
        io.to(challengeId).emit("game-over", {
          winnerUid: challenge.challengedUid,
        });
        // await updateStats(io, challengeId, "tiger");
        return;
      }
    });

    socket.on("disconnect", () => {
      console.log("❌ Socket disconnected:", socket.id);
    });
    socket.on("find-match", ({ role, uid }) => {
      socket.data.uid = uid;
      const oppRole = role === "goat" ? "tiger" : "goat";

      if (waiting[oppRole].length) {
        const rival = waiting[oppRole].shift();
        const roomId = `${socket.id.slice(0, 4)}-${rival.id.slice(0, 4)}`;

        socket.join(roomId);
        rival.join(roomId);

        io.sockets.adapter.rooms.get(roomId).meta = {
          goat: role === "goat" ? socket.data.uid : rival.data.uid,
          tiger: role === "tiger" ? socket.data.uid : rival.data.uid,
        };

        io.to(roomId).emit("match-found", {
          roomId,
          startBoard: freshBoard(),
          startTurn: "goat",
        });
      } else {
        waiting[role].push(socket);
      }
    });

    socket.on("cancel-find", ({ role }) => {
      if (!role) return;
      waiting[role] = waiting[role].filter((s) => s.id !== socket.id);
    });

    /* goat placement */
    socket.on("goat-place", ({ roomId, to }) => {
      const state = getRoomState(roomId);
      if (!state) return;

      state.board.goats.push(to);
      state.turn = "tiger";
      io.to(roomId).emit("state", state);
    });

    /* normal move */
    socket.on("move", async ({ roomId, from, to }) => {
      const st = getRoomState(roomId);
      if (!st) return;

      const arr = st.turn === "goat" ? st.board.goats : st.board.tigers;
      const idx = arr.findIndex(
        (p) => p.row === from.row && p.col === from.col
      );
      arr[idx] = to;
      st.turn = st.turn === "goat" ? "tiger" : "goat";
      io.to(roomId).emit("state", st);

      if (st.turn === "tiger" && !tigerHasValidMove(st.board)) {
        io.to(roomId).emit("game-over", { winner: "goat" });
        await updateStats(io, roomId, "goat");
        return;
      }
    });

    /* tiger jump */
    socket.on("tiger-jump", async ({ roomId, from, to, killed }) => {
      const state = getRoomState(roomId);
      if (!state) return;

      const board = state.board;

      // Move tiger
      const tigerIdx = board.tigers.findIndex(
        (t) => t.row === from.row && t.col === from.col
      );
      if (tigerIdx === -1) return;
      board.tigers[tigerIdx] = to;

      // Remove goat
      board.goats = board.goats.filter(
        (g) => !(g.row === killed.row && g.col === killed.col)
      );
      board.goatsKilled += 1;

      // Check for tiger win
      if (board.goatsKilled >= 5) {
        io.to(roomId).emit("game-over", { winner: "tiger" });
        await updateStats(io, roomId, "tiger");
        return;
      }

      state.turn = "goat";
      io.to(roomId).emit("state", state);
    });

    /* clean up */
    socket.on("disconnect", () => {
      ["goat", "tiger"].forEach((r) => {
        waiting[r] = waiting[r].filter((s) => s.id !== socket.id);
      });
    });
  });

  /* attach a state skeleton when room created */
  io.of("/").adapter.on("create-room", (roomId) => {
    io.sockets.adapter.rooms.get(roomId).state = {
      board: freshBoard(),
      turn: "goat",
    };
  });
}
