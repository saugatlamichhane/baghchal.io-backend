// socketServer.js ── matchmaking + realtime game transport
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
  console.log(`📈 Updating stats: Winner=${winnerId}, Loser=${loserId}`);

  try {
    const [winnerUser, loserUser] = await Promise.all([
      User.findOne({ uid: winnerId }),
      User.findOne({ uid: loserId }),
    ]);

    if (!winnerUser || !loserUser) {
      console.error("❌ One or both users not found in DB");
      return;
    }

    const expectedWin =
      1 / (1 + Math.pow(10, (loserUser.elo - winnerUser.elo) / 400));
    const expectedLose = 1 - expectedWin;

    const winnerNewElo = Math.round(winnerUser.elo + K * (1 - expectedWin));
    const loserNewElo = Math.round(loserUser.elo + K * (0 - expectedLose));

    await Promise.all([
      User.updateOne(
        { uid: winnerId },
        { $inc: { wins: 1 }, $set: { elo: winnerNewElo } }
      ),
      User.updateOne(
        { uid: loserId },
        { $inc: { losses: 1 }, $set: { elo: loserNewElo } }
      ),
    ]);

    console.log(
      `✅ Stats updated. Winner Elo: ${winnerNewElo}, Loser Elo: ${loserNewElo}`
    );
  } catch (err) {
    console.error("❌ Failed to update stats:", err);
  }
}

async function makeUpdateStats(challengeId, winner) {
  const challenge = await Challenge.findById(challengeId);
  const winnerId =
    winner === "goat" ? challenge.challengerUid : challenge.challengedUid;
  const loserId =
    winner === "goat" ? challenge.challengedUid : challenge.challengerUid;

  const K = 16;
  console.log(`📈 Updating stats: Winner=${winnerId}, Loser=${loserId}`);

  try {
    const [winnerUser, loserUser] = await Promise.all([
      User.findOne({ uid: winnerId }),
      User.findOne({ uid: loserId }),
    ]);

    if (!winnerUser || !loserUser) {
      console.error("❌ One or both users not found in DB");
      return;
    }

    const expectedWin =
      1 / (1 + Math.pow(10, (loserUser.elo - winnerUser.elo) / 400));
    const expectedLose = 1 - expectedWin;

    const winnerNewElo = Math.round(winnerUser.elo + K * (1 - expectedWin));
    const loserNewElo = Math.round(loserUser.elo + K * (0 - expectedLose));

    await Promise.all([
      User.updateOne(
        { uid: winnerId },
        { $inc: { wins: 1, gamesPlayed: 1 }, $set: { elo: winnerNewElo } }
      ),
      User.updateOne(
        { uid: loserId },
        { $inc: { losses: 1, gamesPlayed: 1 }, $set: { elo: loserNewElo } }
      ),
    ]);

    console.log(
      `✅ Stats updated. Winner Elo: ${winnerNewElo}, Loser Elo: ${loserNewElo}`
    );
  } catch (err) {
    console.error("❌ Failed to update stats:", err);
  }
}

function edgeKey(a, b) {
  const [p1, p2] = [a, b].sort((x, y) => x.row - y.row || x.col - y.col);
  return `${p1.row}-${p1.col}:${p2.row}-${p2.col}`;
}

function tigerHasValidMove(board) {
  return board.tigers.some((from) => {
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
      const occupied = board.goats
        .concat(board.tigers)
        .some((p) => p.row === to.row && p.col === to.col);

      if (VALID_EDGES.has(key) && !occupied) {
        return true;
      }
    }

    for (const { dr, dc } of directions) {
      const mid = { row: from.row + dr, col: from.col + dc };
      const to = { row: from.row + 2 * dr, col: from.col + 2 * dc };
      const edge1 = edgeKey(from, mid);
      const edge2 = edgeKey(mid, to);

      const midHasGoat = board.goats.some(
        (g) => g.row === mid.row && g.col === mid.col
      );
      const toOccupied = board.goats
        .concat(board.tigers)
        .some((p) => p.row === to.row && p.col === to.col);

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
      origin: "https://baghchal.io",
      credentials: true,
    },
  });

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
      goatsPlaced: 0,
    };
  }

  function getRoomState(roomId) {
    const room = io.sockets.adapter.rooms.get(roomId);
    if (!room) return null;
    if (!room.state) {
      room.state = {
        board: freshBoard(),
        turn: "goat",
      };
      console.log(`📦 Created fresh state for room ${roomId}`);
    }
    return room.state;
  }

  io.on("connection", (socket) => {
    console.log(`🔌 New connection: ${socket.id}`);

    socket.on("join_challenge", ({ challengeId }) => {
      console.log(`📥 ${socket.id} joined challenge ${challengeId}`);
      socket.join(challengeId);
    });

    socket.on("make-goat-place", async ({ challengeId, board, turn }) => {
      console.log(`🐐 Goat placed in ${challengeId}. Turn: ${turn}`);
      try {
        const challenge = await Challenge.findById(challengeId);
        if (!challenge || challenge.status !== "in_progress") return;

        const goatLimitReached = board.goatsPlaced >= 20;
        if (goatLimitReached) {
          console.warn("⚠️ Max goats placed. Ignoring move.");
          return;
        }

        await Challenge.findByIdAndUpdate(challengeId, {
          board,
          turn,
          updatedAt: new Date(),
        });

        socket.to(challengeId).emit("move_made", { board, turn });
        console.log(`✅ Move broadcasted to opponent in ${challengeId}`);
      } catch (err) {
        console.error("❌ Error placing goat:", err);
      }
    });

    socket.on("make_move", async ({ challengeId, board, turn }) => {
      console.log(`↪️ Move in ${challengeId}. Turn: ${turn}`);
      try {
        await Challenge.findByIdAndUpdate(challengeId, {
          board,
          turn,
          updatedAt: new Date(),
        });
        socket.to(challengeId).emit("move_made", { board, turn });
      } catch (err) {
        console.error("❌ Move save error:", err);
      }

      const challenge = await Challenge.findById(challengeId);
      if (turn === "tiger" && !tigerHasValidMove(board)) {
        console.log(`🏁 Tigers stuck. Goats win in ${challengeId}`);
        await Challenge.findByIdAndUpdate(challengeId, {
          result: "goat",
          status: "completed",
        });
        await makeUpdateStats(challengeId, "goat");
        io.to(challengeId).emit("game-over", {
          winnerUid: challenge.challengerUid,
        });
        return;
      }
      if (board.goatsKilled >= 5) {
        console.log(`🏁 Tigers win in ${challengeId}`);
        await Challenge.findByIdAndUpdate(challengeId, {
          result: "tiger",
          status: "completed",
        });
        await makeUpdateStats(challengeId, "tiger");
        io.to(challengeId).emit("game-over", {
          winnerUid: challenge.challengedUid,
        });
        return;
      }
    });

    socket.on("find-match", ({ role, uid }) => {
      socket.data.uid = uid;
      const oppRole = role === "goat" ? "tiger" : "goat";
      console.log(`🔍 ${uid} is finding match as ${role}`);

      if (waiting[oppRole].length) {
        const rival = waiting[oppRole].shift();
        const roomId = `${socket.id.slice(0, 4)}-${rival.id.slice(0, 4)}`;

        socket.join(roomId);
        rival.join(roomId);

        io.sockets.adapter.rooms.get(roomId).meta = {
          goat: role === "goat" ? uid : rival.data.uid,
          tiger: role === "tiger" ? uid : rival.data.uid,
        };

        io.to(roomId).emit("match-found", {
          roomId,
          startBoard: freshBoard(),
          startTurn: "goat",
        });

        console.log(`🤝 Match created in ${roomId}`);
      } else {
        waiting[role].push(socket);
        console.log(`📥 ${uid} added to waiting queue as ${role}`);
      }
    });

    socket.on("cancel-find", ({ role }) => {
      if (!role) return;
      waiting[role] = waiting[role].filter((s) => s.id !== socket.id);
      console.log(`❌ ${socket.id} cancelled matchmaking as ${role}`);
    });

    socket.on("goat-place", ({ roomId, to }) => {
      const state = getRoomState(roomId);
      if (!state) return;
      state.board.goats.push(to);
      state.board.goatsKilled++;
      state.turn = "tiger";
      io.to(roomId).emit("state", state);
    });

    socket.on("move", async ({ roomId, from, to }) => {
      const state = getRoomState(roomId);
      if (!state) return;
      const arr =
        state.turn === "goat" ? state.board.goats : state.board.tigers;
      const idx = arr.findIndex(
        (p) => p.row === from.row && p.col === from.col
      );
      arr[idx] = to;
      state.turn = state.turn === "goat" ? "tiger" : "goat";
      io.to(roomId).emit("state", state);

      if (state.turn === "tiger" && !tigerHasValidMove(state.board)) {
        io.to(roomId).emit("game-over", { winner: "goat" });
        await updateStats(io, roomId, "goat");
      }
    });

    socket.on("tiger-jump", async ({ roomId, from, to, killed }) => {
      const state = getRoomState(roomId);
      if (!state) return;

      const board = state.board;
      const tigerIdx = board.tigers.findIndex(
        (t) => t.row === from.row && t.col === from.col
      );
      if (tigerIdx === -1) return;
      board.tigers[tigerIdx] = to;
      board.goats = board.goats.filter(
        (g) => !(g.row === killed.row && g.col === killed.col)
      );
      board.goatsKilled++;

      if (board.goatsKilled >= 5) {
        io.to(roomId).emit("game-over", { winner: "tiger" });
        await updateStats(io, roomId, "tiger");
        return;
      }

      state.turn = "goat";
      io.to(roomId).emit("state", state);
    });

    socket.on("disconnect", () => {
      console.log(`❌ Disconnected: ${socket.id}`);
      ["goat", "tiger"].forEach((r) => {
        waiting[r] = waiting[r].filter((s) => s.id !== socket.id);
      });
    });
  });

  io.of("/").adapter.on("create-room", (roomId) => {
    io.sockets.adapter.rooms.get(roomId).state = {
      board: freshBoard(),
      turn: "goat",
    };
    console.log(`🏠 Room created: ${roomId}`);
  });
}
